// Configuration
// Update the KEYWORD declaration to be modifiable
let KEYWORD = "help:";
const END_PROMPT = "...";

// Add this code after the KEYWORD declaration
// Load saved command keyword from storage
try {
  chrome.storage.sync.get("commandKeyword", function (data) {
    if (chrome.runtime.lastError) {
      console.error("Error loading command keyword:", chrome.runtime.lastError);
      return;
    }

    if (data.commandKeyword && data.commandKeyword.trim() !== "") {
      // Make sure the command has a colon at the end
      let command = data.commandKeyword.trim();
      if (!command.endsWith(":")) {
        command += ":";
      }
      KEYWORD = command;
      console.log("Loaded command keyword from storage:", KEYWORD);
    } else {
      // If empty or not set, use default
      KEYWORD = "help:";
      // Save the default back to storage
      try {
        chrome.storage.sync.set({ commandKeyword: KEYWORD });
      } catch (error) {
        console.error("Error saving default command:", error);
      }
    }
  });
} catch (error) {
  console.error("Extension context error loading command:", error);
  // Keep the default KEYWORD as "help:"
}

// Listen for command keyword update messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "updateCommandKeyword") {
    try {
      // If keyword is empty or just whitespace, set it back to default
      if (!message.keyword || message.keyword.trim() === "") {
        KEYWORD = "help:";
        // Also update storage with default
        chrome.storage.sync.set({ commandKeyword: KEYWORD });

        // Send message back to popup to update input fields with default value
        try {
          chrome.runtime.sendMessage({
            action: "updateCommandInputs",
            keyword: KEYWORD,
          });
        } catch (err) {
          // Ignore errors if popup is not open
          console.log("Could not update popup inputs (popup may be closed)");
        }
      } else {
        // Make sure the command has a colon at the end
        let command = message.keyword.trim();
        // If command is just a colon or ends with a colon but has no text before it
        if (command === ":" || /^\s*:$/.test(command)) {
          command = "help:";
        } else if (!command.endsWith(":")) {
          command += ":";
        }
        KEYWORD = command;
        // Save the properly formatted command
        chrome.storage.sync.set({ commandKeyword: KEYWORD });

        // Send message back to popup to update input fields with formatted value
        try {
          chrome.runtime.sendMessage({
            action: "updateCommandInputs",
            keyword: KEYWORD,
          });
        } catch (err) {
          // Ignore errors if popup is not open
          console.log("Could not update popup inputs (popup may be closed)");
        }
      }
      console.log("Command keyword updated to:", KEYWORD);
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error updating command keyword:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});
const AI_CONFIG = {
  // Current active model: 'gemini', 'gpt4', 'claude', or 'custom'
  activeModel: "gemini", // Default model

  // Gemini Configuration
  gemini: {
    apiKey: "", // Will be loaded from environment
    apiUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent",
    temperature: 0.2,
  },

  // OpenAI Configuration
  gpt4: {
    apiKey: "", // Will be loaded from environment
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    temperature: 0.7,
  },

  // Claude Configuration (using Gemini API)
  claude: {
    apiKey: "", // Will be loaded from environment
    apiUrl:
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent",
    temperature: 0.5,
  },

  // Custom Model Configuration
  custom: {
    apiKey: "", // Will be loaded from storage
    apiUrl: "", // Will be loaded from storage
    temperature: 0.7,
  },
};

// Load saved model preference and custom model config from storage
chrome.storage.sync.get(["activeModel", "customModel"], function (data) {
  if (data.activeModel) {
    AI_CONFIG.activeModel = data.activeModel;
    console.log("Loaded model preference from storage:", AI_CONFIG.activeModel);
  }

  // If custom model exists, load its configuration
  if (data.customModel) {
    AI_CONFIG.custom.apiKey = data.customModel.key || "";
    AI_CONFIG.custom.apiUrl = data.customModel.endpoint || "";
    AI_CONFIG.custom.modelName = data.customModel.name || ""; // Add model name
  }
});

// Listen for model update messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  try {
    if (message.action === "updateModel") {
      AI_CONFIG.activeModel = message.model;

      // If custom model is selected, make sure to load its config
      if (message.model === "custom") {
        chrome.storage.sync.get("customModel", function (data) {
          if (data.customModel) {
            AI_CONFIG.custom.apiKey = data.customModel.key || "";
            AI_CONFIG.custom.apiUrl = data.customModel.endpoint || "";
            console.log("Updated custom model configuration");
          }
        });
      }

      // Save the selected model to storage
      chrome.storage.sync.set({ activeModel: message.model }, function () {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving model preference:",
            chrome.runtime.lastError
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        sendResponse({ success: true });
      });
      return true;
    }

    // Add a handler for logout events
    if (message.action === "userLoggedOut") {
      // Reset to default model when user logs out
      AI_CONFIG.activeModel = "gemini";
      // Update the storage to reflect this change
      chrome.storage.sync.set({ activeModel: "gemini" }, function () {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving model preference:",
            chrome.runtime.lastError
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        sendResponse({ success: true });
      });
      return true;
    }
  } catch (error) {
    console.error("Extension context error in model update:", error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Load API keys from environment with timeout and retry mechanism
let apiKeysLoaded = false;
let apiKeyRetryCount = 0;
const MAX_API_KEY_RETRIES = 3;

// Update the loadApiKeys function to handle Claude API key

function loadApiKeys() {
  try {
    chrome.runtime.sendMessage({ action: "getApiKeys" }, function (response) {
      // Check for extension context invalidated error
      if (chrome.runtime.lastError) {
        console.error("Error getting API keys:", chrome.runtime.lastError);

        // Retry logic
        if (apiKeyRetryCount < MAX_API_KEY_RETRIES) {
          apiKeyRetryCount++;
          setTimeout(loadApiKeys, 1000); // Wait 1 second before retry
        } else {
          // After max retries, set a fallback to prevent infinite waiting
          apiKeysLoaded = true; // Set to true to prevent infinite waiting
        }
        return;
      }

      if (response && response.geminiKey) {
        AI_CONFIG.gemini.apiKey = response.geminiKey;
      }

      if (response && response.openaiKey) {
        AI_CONFIG.gpt4.apiKey = response.openaiKey;
      }

      if (response && response.claudeKey) {
        AI_CONFIG.claude.apiKey = response.claudeKey;
      }

      apiKeysLoaded = true;

      // >>>> ADD THIS LINE HERE <<<<
      setApiKeysBasedOnPlan();
    });
  } catch (error) {
    console.error("Extension context error:", error);
    // Mark as loaded to prevent infinite waiting
    apiKeysLoaded = true;
  }
}

// Start loading API keys
loadApiKeys();

// This line has been moved to the loadApiKeys function

// Immediately set correct keys based on user plan after loading .env keys
setApiKeysBasedOnPlan();

// Also modify the callAIAPI function to add a timeout for waiting for API keys
// Function to call AI API (supports multiple models)
async function callAIAPI(userPrompt) {
  // Wait for API keys to be loaded with a timeout
  if (!apiKeysLoaded) {
    console.log("Waiting for API keys to load...");
    try {
      await Promise.race([
        new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (apiKeysLoaded) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("API key loading timeout")), 5000)
        ),
      ]);
    } catch (error) {
      console.error("API key loading error:", error);
      return "Error: Could not load API keys. Please check your extension configuration.";
    }
  }

  const config = AI_CONFIG[AI_CONFIG.activeModel];

  if (!config) {
    console.error("Invalid model selected:", AI_CONFIG.activeModel);
    return "Error: Invalid AI model selected. Please check your model configuration.";
  }

  let response;
  try {
    if (AI_CONFIG.activeModel === "gemini") {
      response = await callGeminiAPI(userPrompt, config);
    } else if (AI_CONFIG.activeModel === "gpt4") {
      response = await callOpenAIAPI(userPrompt, config);
    } else if (AI_CONFIG.activeModel === "claude") {
      response = await callClaudeAPI(userPrompt, config);
    } else if (AI_CONFIG.activeModel === "custom") {
      response = await callCustomModelAPI(userPrompt, config);
    } else {
      return "Error: Invalid AI model selected. Please choose a valid model.";
    }

    return response;
  } catch (error) {
    console.error("Error in AI API call:", error);
    return `Error: ${error.message}`;
  }
}

// Add this function to handle custom model API calls
async function callCustomModelAPI(userPrompt, config) {
  try {
    // Double-check if API key and URL are available
    if (!config.apiKey || !config.apiUrl) {
      // Try to load them again from storage
      try {
        const data = await new Promise((resolve) => {
          chrome.storage.sync.get("customModel", resolve);
        });

        if (data.customModel) {
          config.apiKey = data.customModel.key || "";
          config.apiUrl = data.customModel.endpoint || "";
          config.modelName = data.customModel.name || ""; // Add this line to get the model name
        }
      } catch (err) {
        console.error("Error loading custom model config:", err);
      }

      // If still missing, return error
      if (!config.apiKey || !config.apiUrl) {
        return "Error: Custom model API key or endpoint is missing. Please add them in the extension settings.";
      }
    }

    // Check if the URL is a Google API (Gemini)
    const isGoogleAPI = config.apiUrl.includes(
      "generativelanguage.googleapis.com"
    );

    let response;
    if (isGoogleAPI) {
      // Use Gemini API format (key as query parameter)
      response = await fetch(`${config.apiUrl}?key=${config.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: config.temperature,
          },
        }),
      });
    } else if (config.apiUrl.includes("api.openai.com")) {
      // Use OpenAI API format
      response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelName || "gpt-4o", // Use the model name from config or default to gpt-4o
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: config.temperature,
        }),
      });
    } else if (config.apiUrl.includes("api.anthropic.com")) {
      // Use Anthropic API format
      response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.modelName || "claude-3-haiku-20240307", // Use the model name from config or default to claude-3-haiku
          max_tokens: 1024,
          temperature: config.temperature,
          messages: [
            {
              role: "user",
              content: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
            },
          ],
        }),
      });
    } else {
      // Generic API format (Bearer token auth)
      // For generic APIs, we might need to include the model in the request body
      const requestBody = {
        prompt: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
        temperature: config.temperature,
      };

      // Add model to the request body if available
      if (config.modelName) {
        requestBody.model = config.modelName;
      }

      response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const status = response.status;
      let errorMessage = `Custom model API error (${status})`;

      if (status === 401 || status === 403) {
        errorMessage = "Authentication error. Please check your API key.";
      } else if (status === 404) {
        errorMessage =
          "API endpoint not found. Please check your endpoint URL.";
      } else if (status >= 500) {
        errorMessage = "Custom model server error. Please try again later.";
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Try to extract the response text from various possible response formats
    let responseText = "";

    if (data.candidates && data.candidates.length > 0) {
      // Gemini API format
      if (data.candidates[0].content && data.candidates[0].content.parts) {
        responseText = data.candidates[0].content.parts[0].text;
      }
    } else if (data.choices && data.choices.length > 0) {
      // OpenAI-like format
      responseText = data.choices[0].text || data.choices[0].message?.content;
    } else if (data.result) {
      // Some custom APIs
      responseText = data.result;
    } else if (data.response) {
      // Some custom APIs
      responseText = data.response;
    } else if (data.output) {
      // Some custom APIs
      responseText = data.output;
    } else if (data.generated_text) {
      // Hugging Face format
      responseText = data.generated_text;
    } else {
      // If we can't find a standard format, return the whole response as JSON
      responseText = JSON.stringify(data);
    }

    return responseText;
  } catch (error) {
    console.error("Error calling custom model API:", error);
    return `Error: ${error.message}`;
  }
}
// Function to call Gemini API
async function callGeminiAPI(userPrompt, config) {
  try {
    // Check if API key is available
    if (!config.apiKey) {
      return "Error: Gemini API key is missing. Please add your API key in the extension settings.";
    }

    const response = await fetch(`${config.apiUrl}?key=${config.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.temperature,
        },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage;

      // Provide more specific error messages based on status code
      if (status === 403) {
        errorMessage =
          "API access forbidden. This could be due to an invalid Gemini API key or you've reached your quota limit. Please check your API key in the extension settings.";
      } else if (status === 429) {
        errorMessage =
          "Too many requests. You've reached the rate limit for the Gemini API. Please try again later.";
      } else if (status === 400) {
        errorMessage =
          "Invalid or missing Gemini API key. Please check your API key in the extension settings.";
      } else if (status >= 500) {
        errorMessage = "Gemini API server error. Please try again later.";
      } else {
        errorMessage = `Gemini API error (${status}). Please check your API key and try again.`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return `Error: ${error.message}`;
  }
}

// Function to call OpenAI API
async function callOpenAIAPI(userPrompt, config) {
  try {
    if (!config.apiKey) {
      return "Error: OpenAI API key is missing. Please add your API key in the extension settings.";
    }

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage;

      // Provide more specific error messages based on status code
      if (status === 401 || status === 403) {
        errorMessage =
          "API access forbidden. This could be due to an invalid OpenAI API key or you've reached your quota limit. Please check your API key in the extension settings.";
      } else if (status === 429) {
        errorMessage =
          "Too many requests. You've reached the rate limit for the OpenAI API. Please try again later.";
      } else if (status === 400) {
        errorMessage =
          "Invalid or missing OpenAI API key or model. Please check your API key and model configuration in the extension settings.";
      } else if (status >= 500) {
        errorMessage = "OpenAI API server error. Please try again later.";
      } else {
        errorMessage = `OpenAI API error (${status}). Please check your API key and try again.`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from OpenAI API");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return `Error: ${error.message}`;
  }
}

// Function to call Claude API (actually using Gemini API)
async function callClaudeAPI(userPrompt, config) {
  try {
    if (!config.apiKey) {
      return "Error: Claude API key is missing. Please add your API key in the extension settings.";
    }

    // Detect if using Anthropic endpoint (free plan)
    if (config.apiUrl === "https://api.anthropic.com/v1/messages") {
      // Anthropic Claude API format
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // or another supported model
          max_tokens: 1024,
          temperature: config.temperature,
          messages: [
            {
              role: "user",
              content: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        let errorMessage;
        if (status === 401 || status === 403) {
          errorMessage =
            "API access forbidden. This could be due to an invalid Claude API key or you've reached your quota limit. Please check your API key in the extension settings.";
        } else if (status === 429) {
          errorMessage =
            "Too many requests. You've reached the rate limit for the Claude API. Please try again later.";
        } else if (status === 400) {
          errorMessage =
            "Invalid or missing Claude API key. Please check your API key in the extension settings.";
        } else if (status >= 500) {
          errorMessage = "Claude API server error. Please try again later.";
        } else {
          errorMessage = `Claude API error (${status}). Please check your API key and try again.`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Anthropic Claude API returns the response in data.content (array of objects)
      if (
        data &&
        data.content &&
        Array.isArray(data.content) &&
        data.content.length > 0
      ) {
        return data.content.map((part) => part.text).join("");
      } else {
        throw new Error("Invalid response format from Claude API");
      }
    } else {
      // Gemini API format (paid plan)
      const response = await fetch(`${config.apiUrl}?key=${config.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: SYSTEM_PROMPT + "\n\nUser query: " + userPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: config.temperature,
          },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        let errorMessage;
        if (status === 403) {
          errorMessage =
            "API access forbidden. This could be due to an invalid API key or you've reached your quota limit. Please check your API key in the extension settings.";
        } else if (status === 429) {
          errorMessage =
            "Too many requests. You've reached the rate limit for the API. Please try again later.";
        } else if (status === 400) {
          errorMessage =
            "Invalid or missing Claude API key. Please check your API key in the extension settings.";
        } else if (status >= 500) {
          errorMessage = "API server error. Please try again later.";
        } else {
          errorMessage = `Claude API error (${status}). Please check your API key and try again.`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    console.error("Error calling Claude (via Gemini/Anthropic API):", error);
    return `Error: ${error.message}`;
  }
}

// System prompt to guide the AI's behavior
const SYSTEM_PROMPT = `
You are an AI assistant in a browser-based tool. Your responses must be direct, plain text, and strictly formatted as per user instructions.
Instructions:

Default Behavior (Concise & No Formatting):
Respond with direct, plain text unless otherwise specified.
No markdown, no bold, no bullet points, no numbered lists unless explicitly requested.
No extra explanations, disclaimers, or unnecessary phrases (e.g., "Hope this helps" or "Here is your answer").
Lists should be plain text without formatting unless formatting is required.

Long-Form Content (When Requested):
If the user asks for a blog, LinkedIn post, email, or other long-form content, provide a well-structured, engaging, and detailed response.
Use natural and professional language while keeping the tone appropriate for the requested format.
Ensure the content is impactful, informative, and suited to the audience (e.g., persuasive for emails, engaging for LinkedIn).
Follow industry best practices for the requested content type (e.g., an email should have a clear subject, greeting, body, and CTA).
Formatting Rules for Long-Form Content:
Use paragraphs for readability.
If headings or bullet points enhance clarity, they are allowed.
No unnecessary repetition or filler content.`;

let isCapturing = false;
let capturedText = "";

// Function to check if an element is an input field
function isInputElement(element) {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    element.contentEditable === "true" ||
    element.getAttribute("role") === "textbox"
  );
}

// Function to update input field with response
function updateInputField(element, text) {
  if (
    element.tagName.toLowerCase() === "input" ||
    element.tagName.toLowerCase() === "textarea"
  ) {
    element.value = text;
  } else if (element.contentEditable === "true") {
    element.textContent = text;
  } else if (element.getAttribute("role") === "textbox") {
    // Handle custom textbox elements
    element.textContent = text;
  }
}

// Function to handle input events
async function handleInput(event) {
  const element = event.target;

  // Only proceed if the element is an input field
  if (!isInputElement(element)) return;

  const currentValue = element.value || element.textContent;

  // Check if the keyword is present
  if (currentValue.includes(KEYWORD)) {
    // If we're not already capturing, start capturing
    if (!isCapturing) {
      isCapturing = true;
      const keywordIndex = currentValue.indexOf(KEYWORD);
      capturedText = currentValue.slice(keywordIndex + KEYWORD.length);

      // Log the captured command
      console.log("AI Assistant Command Detected:", {
        keyword: KEYWORD,
        command: capturedText.trim(),
        model: AI_CONFIG.activeModel,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check for end prompt only if we're capturing
  if (isCapturing && currentValue.includes(END_PROMPT)) {
    try {
      // If we're capturing and the end prompt is detected
      const endPromptIndex = currentValue.indexOf(END_PROMPT);
      const keywordIndex = currentValue.indexOf(KEYWORD);

      // Only process if we have both the keyword and end prompt
      if (keywordIndex !== -1 && endPromptIndex !== -1) {
        capturedText = currentValue.slice(
          keywordIndex + KEYWORD.length,
          endPromptIndex
        );

        // Show loading state
        updateInputField(element, "...");

        // Call AI API and update the field with the response
        const response = await callAIAPI(capturedText.trim());
        updateInputField(element, response);

        // Reset capturing state
        isCapturing = false;
        capturedText = "";
      }
    } catch (error) {
      console.error("Error in handleInput:", error);
      updateInputField(element, `Error: ${error.message}`);
      isCapturing = false;
      capturedText = "";
    }
  }
}

// Add event listeners to all input fields
document.addEventListener("input", handleInput, true);

// Also listen for keypress events on contenteditable elements
document.addEventListener(
  "keypress",
  (event) => {
    const element = event.target;
    if (element.contentEditable === "true") {
      handleInput(event);
    }
  },
  true
);

// Log when the content script is loaded
console.log(
  "AI Assistant Helper: Content script loaded and monitoring for keyword:",
  KEYWORD
);

// Add this near the top of your content.js file, after the AI_CONFIG declaration

// Check for model updates periodically
const checkModelUpdateInterval = setInterval(() => {
  try {
    // Check if chrome.runtime is still available
    if (!chrome || !chrome.runtime) {
      console.log("Chrome runtime no longer available, clearing interval");
      clearInterval(modelUpdateInterval);
      return;
    }

    chrome.storage.sync.get("activeModel", function (data) {
      if (chrome.runtime.lastError) {
        console.error(
          "Error checking model updates:",
          chrome.runtime.lastError
        );

        // If the error is about context invalidation, clear the interval
        if (
          chrome.runtime.lastError.message &&
          chrome.runtime.lastError.message.includes("context invalidated")
        ) {
          console.log("Extension context invalidated, clearing interval");
          clearInterval(modelUpdateInterval);
        }
        return;
      }

      if (
        data &&
        data.activeModel &&
        data.activeModel !== AI_CONFIG.activeModel
      ) {
        AI_CONFIG.activeModel = data.activeModel;
        console.log("Updated model from storage:", AI_CONFIG.activeModel);
      }
    });
  } catch (error) {
    console.error("Extension context error in model update:", error);

    // If we get here, something went wrong with the chrome API
    // Clear the interval to prevent further errors
    clearInterval(modelUpdateInterval);
  }
}, 5000); // Check every 5 seconds

// Function to set API keys based on user plan
function setApiKeysBasedOnPlan() {
  chrome.storage.local.get(
    ["user", "geminiApiKey", "openaiApiKey", "claudeApiKey"],
    function (data) {
      // Get the current model selection to preserve it
      chrome.storage.sync.get("activeModel", function (modelData) {
        // Don't change the active model if it's already set in storage
        // This preserves the user's model selection between sessions
        if (modelData.activeModel) {
          AI_CONFIG.activeModel = modelData.activeModel;
        }

        let plan = "free";
        if (data.user && data.user.plan) {
          plan = data.user.plan.toLowerCase();
        }

        if (plan === "free") {
          // Always use ONLY the user-provided keys for free users, even if invalid or empty
          AI_CONFIG.gemini.apiKey =
            typeof data.geminiApiKey === "string" ? data.geminiApiKey : "";
          AI_CONFIG.gpt4.apiKey =
            typeof data.openaiApiKey === "string" ? data.openaiApiKey : "";
          AI_CONFIG.claude.apiKey =
            typeof data.claudeApiKey === "string" ? data.claudeApiKey : "";
          // Set Claude API URL for free users
          AI_CONFIG.claude.apiUrl = "https://api.anthropic.com/v1/messages";
          // Removed verbose logs here
        } else {
          // Use .env keys (already loaded at startup)
          // Set Claude API URL for paid users (Gemini endpoint)
          AI_CONFIG.claude.apiUrl =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
          // Removed verbose logs here
        }
      });
    }
  );
}

// Call on startup
setApiKeysBasedOnPlan();

// Also call whenever user or API keys are updated
chrome.storage.onChanged.addListener(function (changes, area) {
  if (
    area === "local" &&
    (changes.user ||
      changes.geminiApiKey ||
      changes.openaiApiKey ||
      changes.claudeApiKey)
  ) {
    setApiKeysBasedOnPlan();
  }
});

// Log when the content script is loaded
console.log(
  "AI Assistant Helper: Content script loaded and monitoring for keyword:",
  KEYWORD
);

// Add this near the top of your content.js file, after the AI_CONFIG declaration

// Check for model updates periodically
const modelUpdateInterval = setInterval(() => {
  try {
    // Check if chrome.runtime is still available
    if (!chrome || !chrome.runtime) {
      console.log("Chrome runtime no longer available, clearing interval");
      clearInterval(modelUpdateInterval);
      return;
    }

    chrome.storage.sync.get("activeModel", function (data) {
      if (chrome.runtime.lastError) {
        console.error(
          "Error checking model updates:",
          chrome.runtime.lastError
        );

        // If the error is about context invalidation, clear the interval
        if (
          chrome.runtime.lastError.message &&
          chrome.runtime.lastError.message.includes("context invalidated")
        ) {
          console.log("Extension context invalidated, clearing interval");
          clearInterval(modelUpdateInterval);
        }
        return;
      }

      if (
        data &&
        data.activeModel &&
        data.activeModel !== AI_CONFIG.activeModel
      ) {
        AI_CONFIG.activeModel = data.activeModel;
        console.log("Updated model from storage:", AI_CONFIG.activeModel);
      }
    });
  } catch (error) {
    console.error("Extension context error in model update:", error);

    // If we get here, something went wrong with the chrome API
    // Clear the interval to prevent further errors
    clearInterval(modelUpdateInterval);
  }
}, 5000); // Check every 5 seconds
