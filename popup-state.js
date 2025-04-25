// Cross-browser API wrapper
const browserApi = window.browser || window.chrome;

// Initialize the UI state
document.addEventListener("DOMContentLoaded", function () {
  try {
    // Ensure container fills the entire space
    const container = document.querySelector(".container");
    if (container) {
      container.style.height = "100%";
    }

    // Load saved settings
    browserApi.storage.local.get(["aiModel", "commandKeyword"], function (result) {
      if ((browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError)) {
        console.error("Error loading settings:", (browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError));
        return;
      }

      // Set model if saved
      if (result.aiModel) {
        const modelSelect = document.getElementById("modelSelect");
        if (modelSelect) {
          modelSelect.value = result.aiModel;
        }
      }

      // Set command if saved
      if (result.commandKeyword) {
        const commandInput = document.getElementById("commandInput");
        if (commandInput) {
          commandInput.value = result.commandKeyword;
        }
      }
    });
  } catch (error) {
    console.error("Error initializing UI state:", error);
  }
});

// Toggle between logged in and logged out states
document.addEventListener("DOMContentLoaded", function () {
  try {
    const loggedInState = document.getElementById("loggedInState");
    const loggedOutState = document.getElementById("loggedOutState");
    const container = document.querySelector(".container");

    // Check if user is logged in from storage
    browserApi.storage.local.get(["user", "isLoggedIn"], function (result) {
      if ((browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError)) {
        console.error("Error checking login state:", (browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError));
        return;
      }

      if (result.isLoggedIn && result.user) {
        // User is logged in, show logged in state
        if (loggedInState && loggedOutState) {
          loggedInState.classList.add("active");
          loggedOutState.classList.remove("active");

          loggedInState.style.display = "flex";
          loggedOutState.style.display = "none";
        }
      } else {
        // User is not logged in, show logged out state
        if (loggedInState && loggedOutState) {
          loggedInState.classList.remove("active");
          loggedOutState.classList.add("active");

          loggedInState.style.display = "none";
          loggedOutState.style.display = "flex";
        }
      }

      // Ensure container fills the entire space
      if (container) {
        container.style.height = "100%";
      }
    });

    // Logout button functionality
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        // Clear user data from storage
        browserApi.storage.local.remove(["user", "isLoggedIn"], function () {
          if ((browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError)) {
            console.error("Error during logout:", (browserApi.runtime && browserApi.runtime.lastError) || (chrome && chrome.runtime && chrome.runtime.lastError));
            return;
          }

          // Remove active class and hide logged in state
          if (loggedInState) {
            loggedInState.classList.remove("active");
            loggedInState.style.display = "none";
          }

          // Add active class and show logged out state
          if (loggedOutState) {
            loggedOutState.classList.add("active");
            loggedOutState.style.display = "flex";
          }

          // Ensure the container fills the entire space
          if (container) {
            container.style.height = "100%";
          }

          // Ensure the logged out state fills the container properly
          if (loggedOutState) {
            loggedOutState.style.height = "100%";
          }
        });
      });
    }
  } catch (error) {
    console.error("Error in login state management:", error);
  }
});
