// Background script for AI Assistant Helper
// We can't use import() or importScripts() with module type service workers
// So we'll use a different approach with fetch and chrome.storage

// Supabase configuration
const SUPABASE_URL = "YOUR_SUPABASE_URL"; // Replace with your Supabase URL
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"; // Replace with your Supabase anon key

// User authentication state
let currentUser = null;
let userCredits = 0;
let userTier = "free";

// Simple fetch wrapper for Supabase API calls
async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const defaultOptions = {
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  return await response.json();
}

// Auth functions using REST API directly
async function getSession() {
  // Get session from storage
  const { session } = await new Promise((resolve) => {
    chrome.storage.local.get(["session"], resolve);
  });

  if (!session) return { data: { session: null } };

  // Verify session is still valid
  try {
    const result = await supabaseFetch("/auth/v1/user", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (result.error) {
      // Session expired
      chrome.storage.local.remove(["session"]);
      return { data: { session: null } };
    }

    return { data: { session, user: result } };
  } catch (error) {
    console.error("Error verifying session:", error);
    return { data: { session: null } };
  }
}

async function signIn(email, password) {
  try {
    const result = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (result.error) {
      return { error: result.error };
    }

    // Store session
    chrome.storage.local.set({ session: result });

    return { data: result };
  } catch (error) {
    console.error("Error signing in:", error);
    return { error: error.message };
  }
}

async function signUp(email, password, userData) {
  try {
    const result = await supabaseFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: userData,
      }),
    });

    if (result.error) {
      return { error: result.error };
    }

    // Auto sign in after registration
    return await signIn(email, password);
  } catch (error) {
    console.error("Error signing up:", error);
    return { error: error.message };
  }
}

async function signOut() {
  try {
    const { session } = await new Promise((resolve) => {
      chrome.storage.local.get(["session"], resolve);
    });

    if (session) {
      await supabaseFetch("/auth/v1/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }

    // Clear session
    chrome.storage.local.remove(["session"]);

    return { error: null };
  } catch (error) {
    console.error("Error signing out:", error);
    return { error: error.message };
  }
}

// Check if user is logged in
async function checkAuthState() {
  const { session } = await getSession();

  if (session) {
    currentUser = session.user;
    await fetchUserData();
    return true;
  }

  return false;
}

// Fetch user data from database
async function fetchUserData() {
  if (!currentUser) return;

  try {
    const { session } = await new Promise((resolve) => {
      chrome.storage.local.get(["session"], resolve);
    });

    if (!session) return;

    const result = await supabaseFetch("/rest/v1/users", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Range: "0-0",
        Prefer: "return=representation",
      },
      method: "GET",
    });

    if (result.error) {
      console.error("Error fetching user data:", result.error);
      return;
    }

    if (result.length > 0) {
      const userData = result[0];
      userCredits = userData.credits_available;
      userTier = userData.subscription_tier;

      // Store user data in extension storage
      chrome.storage.local.set({
        userData: {
          id: currentUser.id,
          email: currentUser.email,
          credits: userCredits,
          tier: userTier,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }
}

// Load environment variables from .env file
let envVariables = {};

fetch(chrome.runtime.getURL(".env"))
  .then((response) => response.text())
  .then((text) => {
    // Parse .env file
    const lines = text.split("\n");
    lines.forEach((line) => {
      // Skip comments and empty lines
      if (line.trim().startsWith("#") || line.trim() === "") return;

      // Parse key-value pairs
      const [key, value] = line.split("=").map((part) => part.trim());
      if (key && value) {
        envVariables[key] = value;
      }
    });
  })
  .catch((error) => {});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);

  if (message.action === "getApiKeys") {
    console.log("Sending API keys to content script");
    sendResponse({
      geminiKey: envVariables.GEMINI_API_KEY || "",
      openaiKey: envVariables.OPENAI_API_KEY || "",
      claudeKey: envVariables.CLAUDE_API_KEY || "", // Add Claude API key
    });
    return true; // Keep the message channel open for async response
  }

  if (message.action === "checkAuth") {
    checkAuthState()
      .then((isLoggedIn) => {
        sendResponse({
          isLoggedIn,
          user: currentUser,
          credits: userCredits,
          tier: userTier,
        });
      })
      .catch((error) => {
        console.error("Error checking auth state:", error);
        sendResponse({ isLoggedIn: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }

  // Updated handler for credit operations
  if (message.action === "checkUserCredits") {
    // Get the latest user data directly from storage
    chrome.storage.local.get(["user", "freeCredits"], function (data) {
      const userData = data.user || {};
      let credits = userData.credits;
      const isLoggedIn = !!userData.uid;

      // If user is not logged in or has 0 credits, use free tier credits
      if (!isLoggedIn || credits === 0 || credits === undefined) {
        // Use free tier credits for non-logged in users
        credits = data.freeCredits !== undefined ? data.freeCredits : 10;

        // Initialize free credits if not set
        if (data.freeCredits === undefined) {
          chrome.storage.local.set({ freeCredits: 10 });
        }

        console.log("Using free tier credits:", credits);
      }

      console.log(
        "Background script checking credits:",
        credits,
        "isLoggedIn:",
        isLoggedIn
      );

      sendResponse({
        isLoggedIn: isLoggedIn,
        credits: credits,
        isFreeUser: !isLoggedIn,
      });
    });
    return true;
  }

  // Add a new function to decrement user credits
  async function decrementUserCredits() {
    try {
      // Get user data from storage
      const userData = await new Promise((resolve) => {
        chrome.storage.local.get(["user", "userData", "freeCredits"], resolve);
      });

      // Use either user or userData object, whichever is available
      const user = userData.user || userData.userData || {};
      const currentCredits = user.credits;

      // Check if user is logged in with valid credits
      if (user.uid && currentCredits !== undefined && currentCredits > 0) {
        const newCredits = currentCredits - 1;
        user.credits = newCredits;
        await new Promise((resolve) => {
          chrome.storage.local.set({ user: user }, resolve);
        });
        userCredits = newCredits;
        return { success: true, uid: user.uid, credits: newCredits };
      }
      // Handle free tier users (no uid but should still have credits)
      else if (!user.uid) {
        let currentFreeCredits = userData.freeCredits;
        if (currentFreeCredits === undefined) {
          currentFreeCredits = 10;
          await new Promise((resolve) => {
            chrome.storage.local.set(
              { freeCredits: currentFreeCredits },
              resolve
            );
          });
        }
        if (currentFreeCredits > 0) {
          const newFreeCredits = currentFreeCredits - 1;
          await new Promise((resolve) => {
            chrome.storage.local.set({ freeCredits: newFreeCredits }, resolve);
          });
          return { success: true, credits: newFreeCredits, isFreeUser: true };
        } else {
          return { success: false, error: "No free credits remaining" };
        }
      } else {
        return { success: false, error: "No valid credits found" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (message.action === "decrementCredits") {
    decrementUserCredits()
      .then((result) => {
        sendResponse(result);
        chrome.runtime
          .sendMessage({
            action: "creditsUpdated",
            credits: userCredits,
          })
          .catch((err) => {
            console.log(
              "Could not notify popup about credit update (popup may be closed)"
            );
          });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // <--- This is important for async sendResponse
  }
});

// Remove this duplicate code that was causing the error
// if (message.action === "checkUserCredits") { ... }

// Listen for messages from the web application
chrome.runtime.onMessageExternal.addListener(function (
  request,
  sender,
  sendResponse
) {
  console.log("Received external message:", request);

  // Handle authentication messages
  if (request.type === "AUTH_STATE_CHANGED") {
    if (request.user) {
      // User is logged in, store user data
      chrome.storage.local.set(
        {
          user: request.user,
          isLoggedIn: true,
        },
        function () {
          console.log("User data saved:", request.user);
          sendResponse({ success: true });
        }
      );
    } else {
      // User logged out, clear data
      chrome.storage.local.remove(["user", "isLoggedIn"], function () {
        console.log("User data cleared");
        sendResponse({ success: true });
      });
    }
    return true; // Keep the message channel open for async response
  }

  // Handle user data update (credits, subscription, etc.)
  if (request.type === "USER_DATA_UPDATE") {
    chrome.storage.local.get(["user"], function (result) {
      if (result.user && result.user.uid === request.userData.uid) {
        // Update user data
        const updatedUser = { ...result.user, ...request.userData };
        chrome.storage.local.set(
          {
            user: updatedUser,
          },
          function () {
            console.log("User data updated:", updatedUser);
            sendResponse({ success: true });
          }
        );
      } else {
        sendResponse({
          success: false,
          error: "User not found or ID mismatch",
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
});
