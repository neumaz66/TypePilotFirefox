// Cross-browser API wrapper
const browserApi = window.browser || window.chrome;

// Create a new popup.js file with a single DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", function () {
  console.log("Popup loaded");

  // DOM Elements
  const loggedInState = document.getElementById("loggedInState");
  const loggedOutState = document.getElementById("loggedOutState");
  const userEmail = document.querySelector(".user-email");
  const userPlan = document.querySelector(".user-plan");
  const creditsValue = document.querySelector(".credits-display .value span");
  const buyMoreBtn = document.querySelector(".buy-credits-btn");
  const logoutButton = document.getElementById("logoutButton");
  const signupButton = document.getElementById("signupButton");
  const commandInput = document.getElementById("commandInput");
  const commandInputLoggedOut = document.getElementById("commandInputLoggedOut");
  const modelSelect = document.getElementById("modelSelect");
  const modelSelectLoggedOut = document.getElementById("modelSelectLoggedOut");
  const suffixHint = document.querySelector(".suffix-hint");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const openaiApiKeyInput = document.getElementById("openaiApiKey");
  const claudeApiKeyInput = document.getElementById("claudeApiKey");

  // --- Load saved model and API keys on popup open ---
  browserApi.storage.sync.get(["activeModel", "geminiApiKey", "openaiApiKey", "claudeApiKey"], function(data) {
    // Set model dropdown
    if (modelSelect && data.activeModel) {
      modelSelect.value = getModelValue(data.activeModel);
    }
    if (modelSelectLoggedOut && data.activeModel) {
      modelSelectLoggedOut.value = getModelValue(data.activeModel);
    }
    // Set API key fields
    if (geminiApiKeyInput && data.geminiApiKey) geminiApiKeyInput.value = data.geminiApiKey;
    if (openaiApiKeyInput && data.openaiApiKey) openaiApiKeyInput.value = data.openaiApiKey;
    if (claudeApiKeyInput && data.claudeApiKey) claudeApiKeyInput.value = data.claudeApiKey;
  });

  // --- Save model selection ---
  if (modelSelect) {
    modelSelect.addEventListener("change", function () {
      const selectedValue = modelSelect.value;
      const modelName = getModelName(selectedValue);
      browserApi.storage.sync.set({ activeModel: modelName }, function () {
        // Optionally update other UI or notify scripts
      });
    });
  }

  // --- Save API keys ---
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener("click", function () {
      const geminiKey = geminiApiKeyInput ? geminiApiKeyInput.value : "";
      const openaiKey = openaiApiKeyInput ? openaiApiKeyInput.value : "";
      const claudeKey = claudeApiKeyInput ? claudeApiKeyInput.value : "";
      browserApi.storage.sync.set({
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        claudeApiKey: claudeKey
      }, function() {
        // Optionally show success feedback
      });
    });
  }

  // Initialize UI state - default to logged out
  if (loggedInState) loggedInState.classList.remove("active");
  if (loggedOutState) loggedOutState.classList.add("active");

  // Check if user is logged in
  browserApi.storage.local.get(["user", "isLoggedIn"], function (result) {
    if (result.isLoggedIn && result.user) {
      // User is logged in, update UI
      showLoggedInState(result.user);
    } else {
      // User is logged out
      showLoggedOutState();
    }
  });

  // Add listener for credit updates from background script
  browserApi.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "creditsUpdated" && creditsValue) {
      // Update the credits display
      creditsValue.textContent = message.credits;
      console.log("Credits updated in popup:", message.credits);
    }
    return true;
  });

  // Functions
  function showLoggedInState(user) {
    if (loggedInState) loggedInState.classList.add("active");
    if (loggedOutState) loggedOutState.classList.remove("active");

    // Update user info
    if (userEmail) userEmail.textContent = user.email || "User";

    // Update plan info
    if (userPlan)
      userPlan.textContent = user.plan
        ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan`
        : "Free Plan";

    // Update credits
    if (creditsValue) creditsValue.textContent = user.credits || 0;

    // Update buy more button to point to your web app
    if (buyMoreBtn) {
      buyMoreBtn.href = "http://localhost:3001/pricing";
    }

    // Update model options based on user plan
    if (modelSelect) {
      updateModelOptions(modelSelect, user.plan || "free");
    }
  }

  // Handle logout button click
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      browserApi.storage.local.remove(["user", "isLoggedIn"], function () {
        // Notify content script about logout
        browserApi.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs[0]) {
              browserApi.tabs
                .sendMessage(tabs[0].id, { action: "userLoggedOut" })
                .catch((err) =>
                  console.log("Could not notify content script about logout")
                );
            }
          }
        );

        showLoggedOutState();
      });
    });
  }

  // Update the signup button to open your web app
  if (signupButton) {
    signupButton.addEventListener("click", function (e) {
      e.preventDefault();
      browserApi.tabs.create({ url: "http://localhost:3001" });
    });
  }

  // Command input preview
  if (commandInput) {
    commandInput.addEventListener("input", function () {
      updateCommandPreview(commandInput, suffixHint);
    });

    commandInput.addEventListener("change", function () {
      updateCommandKeyword(this.value);
    });

    commandInput.addEventListener("blur", function () {
      updateCommandKeyword(this.value);
    });
  }

  if (commandInputLoggedOut) {
    commandInputLoggedOut.addEventListener("input", function () {
      updateCommandPreview(commandInputLoggedOut, suffixHint);
    });

    commandInputLoggedOut.addEventListener("change", function () {
      updateCommandKeyword(this.value);
    });

    commandInputLoggedOut.addEventListener("blur", function () {
      updateCommandKeyword(this.value);
    });
  }

  // Load saved command keyword from storage
  browserApi.storage.sync.get("commandKeyword", function (data) {
    if (data.commandKeyword) {
      // Remove the colon for display in the input field
      let displayKeyword = data.commandKeyword;
      if (displayKeyword.endsWith(":")) {
        displayKeyword = displayKeyword.slice(0, -1);
      }

      if (commandInput) commandInput.value = displayKeyword;
      if (commandInputLoggedOut) {
        commandInputLoggedOut.value = displayKeyword;
        // Make the command input read-only for logged-out users
        commandInputLoggedOut.readOnly = true;
        // Add a tooltip or placeholder to inform users
        commandInputLoggedOut.title = "Sign in to change command keyword";

        // Also disable the save button for logged-out users if it exists
        const saveCommandBtnLoggedOut = document.getElementById(
          "saveCommandBtnLoggedOut"
        );
        if (saveCommandBtnLoggedOut) {
          saveCommandBtnLoggedOut.disabled = true;
          saveCommandBtnLoggedOut.title = "Sign in to change command keyword";
        }

        // Optionally add a small info text below the input
        const commandHintLoggedOut = document.querySelector(
          ".command-hint-logged-out"
        );
        if (commandHintLoggedOut) {
          const infoText = document.createElement("div");
          infoText.className = "info-text";
          infoText.textContent = "Sign in to customize command";
          infoText.style.fontSize = "12px";
          infoText.style.color = "#888";
          infoText.style.marginTop = "4px";
          commandHintLoggedOut.appendChild(infoText);
        }
      }
    } else {
      // Set default command if none is saved
      const defaultCommand = "help";
      if (commandInput) commandInput.value = defaultCommand;
      if (commandInputLoggedOut) commandInputLoggedOut.value = defaultCommand;
      // Save the default command
      browserApi.storage.sync.set({ commandKeyword: defaultCommand + ":" });
    }

    // Initialize command preview
    if (commandInput && suffixHint)
      updateCommandPreview(commandInput, suffixHint);
    if (commandInputLoggedOut && suffixHint)
      updateCommandPreview(commandInputLoggedOut, suffixHint);
  });

  // Handle model selection
  if (modelSelect) {
    // Load the saved model preference
    browserApi.storage.sync.get("activeModel", function (data) {
      if (browserApi.runtime.lastError) {
        console.error(
          "Error loading model preference:",
          browserApi.runtime.lastError
        );
        return;
      }

      const defaultModel = "gemini"; // Set default to gemini
      const activeModel = data.activeModel || defaultModel;

      // Get user plan to determine available models
      browserApi.storage.local.get(["user", "isLoggedIn"], function (result) {
        if (browserApi.runtime.lastError) {
          console.error("Error loading user data:", browserApi.runtime.lastError);
          return;
        }

        const userPlan =
          result.isLoggedIn && result.user ? result.user.plan : "free";

        // Set the dropdown to the saved value or default
        if (modelSelect) {
          // Map the model name to the select option value
          const modelValue = getModelValue(activeModel);

          // Reset options based on plan
          updateModelOptions(modelSelect, userPlan);

          // If the previously selected model is not available for this plan,
          // default to gemini
          if (userPlan === "free" && activeModel === "gpt4") {
            modelSelect.value = "gemini-pro";
            // Save the new default model
            browserApi.storage.sync.set({ activeModel: "gemini" }, function () {
              if (browserApi.runtime.lastError) {
                console.error(
                  "Error saving model preference:",
                  browserApi.runtime.lastError
                );
              }
            });
          } else {
            modelSelect.value = modelValue;
          }
        }

        // Also set the logged out state dropdown (though it's disabled)
        if (modelSelectLoggedOut) {
          updateModelOptions(modelSelectLoggedOut, "free");
          const modelValue = getModelValue(
            activeModel === "gpt4" && userPlan === "free"
              ? "gemini"
              : activeModel
          );
          modelSelectLoggedOut.value = modelValue;
        }
      });
    });

    // Add change event listener to the model selector
    modelSelect.addEventListener("change", function () {
      const selectedValue = modelSelect.value;
      // Convert the select value to the model name expected by content.js
      const modelName = getModelName(selectedValue);

      // Save to storage
      browserApi.storage.sync.set({ activeModel: modelName }, function () {
        // Notify content script
        browserApi.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs[0]) {
              browserApi.tabs.sendMessage(tabs[0].id, {
                action: "updateModel",
                model: modelName,
              });
            }
          }
        );
      });
    });
  }

  // Functions
  function showLoggedInState(user) {
    if (loggedInState) loggedInState.classList.add("active");
    if (loggedOutState) loggedOutState.classList.remove("active");

    // Update user info
    if (userEmail) userEmail.textContent = user.email || "User";

    // Update plan info
    if (userPlan)
      userPlan.textContent = user.plan
        ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan`
        : "Free Plan";

    // Update credits
    if (creditsValue) creditsValue.textContent = user.credits || 0;

    // Update buy more button to point to your web app
    if (buyMoreBtn) {
      buyMoreBtn.href = "http://localhost:3001/pricing";
    }

    // Update model options based on user plan
    if (modelSelect) {
      updateModelOptions(modelSelect, user.plan || "free");
    }
  }

  // Add this new function to update model options based on plan
  function updateModelOptions(selectElement, plan) {
    if (!selectElement) return;

    // Save current selection if possible
    const currentValue = selectElement.value;

    // Clear existing options
    while (selectElement.firstChild) {
      selectElement.removeChild(selectElement.firstChild);
    }

    // Always add Gemini and Claude options
    const geminiOption = document.createElement("option");
    geminiOption.value = "gemini";
    geminiOption.textContent = "Gemini 2.5 Pro";
    selectElement.appendChild(geminiOption);

    const claudeOption = document.createElement("option");
    claudeOption.value = "claude";
    claudeOption.textContent = "Claude 3";
    selectElement.appendChild(claudeOption);

    // Always add GPT-4 option for all users (including free)
    const gpt4Option = document.createElement("option");
    gpt4Option.value = "gpt4";
    gpt4Option.textContent = "GPT-4";
    selectElement.appendChild(gpt4Option);

    // Load and add custom model if it exists
    browserApi.storage.sync.get("customModel", function (data) {
      if (data.customModel && data.customModel.name) {
        const customOption = document.createElement("option");
        customOption.value = "custom";
        customOption.textContent = data.customModel.name || "Custom Model";
        selectElement.appendChild(customOption);
      }

      // Try to restore previous selection if it's still available
      try {
        // Check if the option exists in the select element
        const optionExists = Array.from(selectElement.options).some(
          (opt) => opt.value === currentValue
        );
        if (optionExists) {
          selectElement.value = currentValue;
        } else {
          // Default to gemini if previous selection is not available
          selectElement.value = "gemini";
        }
      } catch (e) {
        console.error("Error restoring model selection:", e);
        selectElement.value = "gemini";
      }
    });
  }

  // When saving a custom model:
  if (saveCustomModelBtn) {
    saveCustomModelBtn.addEventListener("click", () => {
      // ... get name, endpoint, key ...
      browserApi.storage.sync.set(
        {
          customModel: { name, endpoint, key },
          activeModel: "custom", // Set active model to custom
        },
        () => {
          updateModelOptions(modelSelect, "custom");
          modelSelect.value = "custom";

          // Notify content script about model change
          browserApi.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
              if (tabs[0]) {
                browserApi.tabs
                  .sendMessage(tabs[0].id, {
                    action: "updateModel",
                    model: "custom",
                  })
                  .catch((err) =>
                    console.log("Could not notify content script about model change")
                  );
              }
            }
          );

          // ... close modal, etc ...
        }
      );
    });
  }

  // On popup load:
  // updateModelOptions(modelSelect, "free"); // or pass actual plan

  function showLoggedOutState() {
    if (loggedInState) loggedInState.classList.remove("active");
    if (loggedOutState) loggedOutState.classList.add("active");

    // Make sure command input is read-only in logged-out state
    const commandInputLoggedOut = document.getElementById(
      "commandInputLoggedOut"
    );
    if (commandInputLoggedOut) {
      commandInputLoggedOut.readOnly = true;
      commandInputLoggedOut.title = "Sign in to change command keyword";
    }

    // Disable the save button in logged-out state
    const saveCommandBtnLoggedOut = document.getElementById(
      "saveCommandBtnLoggedOut"
    );
    if (saveCommandBtnLoggedOut) {
      saveCommandBtnLoggedOut.disabled = true;
      saveCommandBtnLoggedOut.title = "Sign in to change command keyword";
    }
  }

  function updateCommandPreview(inputElement, suffixElement) {
    if (inputElement && suffixElement) {
      // Update the preview text
      const command = inputElement.value.trim();

      // Highlight the suffix hint if the command doesn't already end with a colon
      if (command.endsWith(":")) {
        suffixElement.style.opacity = "0.5";
      } else {
        suffixElement.style.opacity = "1";
      }
    }
  }

  function updateCommandKeyword(command) {
    // If command is empty or just whitespace, set to default
    if (!command || command.trim() === "") {
      command = "help";
    }

    // Ensure command ends with a colon
    if (!command.endsWith(":")) {
      command += ":";
    }

    // Save the command to storage
    browserApi.storage.sync.set({ commandKeyword: command }, function () {
      console.log("Command keyword saved:", command);
    });

    // Send message to all tabs to update the command keyword
    browserApi.tabs.query({}, function (tabs) {
      tabs.forEach(function (tab) {
        try {
          browserApi.tabs
            .sendMessage(tab.id, {
              action: "updateCommandKeyword",
              keyword: command,
            })
            .catch(() => {
              // Silently ignore errors for tabs without content script
            });
        } catch (error) {
          // Ignore errors - some tabs might not have our content script
        }
      });
    });
  }

  // Helper function to convert select option value to model name
  function getModelName(value) {
    switch (value) {
      case "gpt4":
        return "gpt4";
      case "gemini":
      case "gemini-pro":
        return "gemini";
      case "claude":
        return "claude";
      case "custom":
        return "custom";
      default:
        return "gemini"; // Default to gemini
    }
  }

  // Helper function to convert model name to select option value
  function getModelValue(modelName) {
    switch (modelName) {
      case "gpt4":
        return "gpt4";
      case "gemini":
        return "gemini";
      case "claude":
        return "claude";
      case "custom":
        return "custom";
      default:
        return "gemini"; // Default to gemini
    }
  }
});

// Add a listener for command input updates from content script
browserApi.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "updateCommandInputs") {
    // Update both command inputs with the new keyword
    const commandInput = document.getElementById("commandInput");
    const commandInputLoggedOut = document.getElementById(
      "commandInputLoggedOut"
    );

    // Remove the colon for display in the input field
    let displayKeyword = message.keyword;
    if (displayKeyword.endsWith(":")) {
      displayKeyword = displayKeyword.slice(0, -1);
    }

    if (commandInput) commandInput.value = displayKeyword;
    if (commandInputLoggedOut) commandInputLoggedOut.value = displayKeyword;

    console.log("Command inputs updated to:", displayKeyword);
    sendResponse({ success: true });
    return true;
  }
});

function updateCreditsDisplay() {
  // Check and reset free credits if needed (for logged-out users)
  resetFreeCreditsIfNeeded(() => {
    // Check and reset logged-in free user credits if needed
    resetLoggedInFreeCreditsIfNeeded(() => {
      browserApi.storage.local.get(["user", "freeCredits"], (data) => {
        let credits = 0;
        if (data.user && data.user.uid) {
          credits = data.user.credits !== undefined ? data.user.credits : 0;
          // Update logged-in state
          const creditsValue = document.querySelector(
            ".credits-display .value span"
          );
          if (creditsValue) creditsValue.textContent = credits;
        } else {
          credits = data.freeCredits !== undefined ? data.freeCredits : 5;
          // Update logged-out state
          const creditsValueLoggedOut = document.querySelector(
            ".credits-info .credits-value"
          );
          if (creditsValueLoggedOut)
            creditsValueLoggedOut.textContent = credits;
        }
      });
    });
  });
}

// Helper to reset free credits to 5 if a new day has started (for logged-out users)
function resetFreeCreditsIfNeeded(callback) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  browserApi.storage.local.get(["freeCreditsLastReset"], (data) => {
    if (data.freeCreditsLastReset !== today) {
      browserApi.storage.local.set(
        { freeCredits: 5, freeCreditsLastReset: today },
        callback
      );
    } else {
      if (callback) callback();
    }
  });
}

// Helper to reset logged-in free user credits to 10 if a new month has started
function resetLoggedInFreeCreditsIfNeeded(callback) {
  browserApi.storage.local.get(["user", "userCreditsLastResetMonth"], (data) => {
    const user = data.user;
    if (user && user.uid && (!user.plan || user.plan === "free")) {
      const now = new Date();
      const currentMonth = now.getFullYear() + "-" + (now.getMonth() + 1); // e.g., "2024-6"
      if (data.userCreditsLastResetMonth !== currentMonth) {
        // Reset credits to 10 and update last reset month
        user.credits = 10;
        browserApi.storage.local.set(
          { user, userCreditsLastResetMonth: currentMonth },
          callback
        );
        return;
      }
    }
    if (callback) callback();
  });
}

// Listen for credit updates from background
browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "creditsUpdated") {
    updateCreditsDisplay();
  }
});

// Call on popup load
document.addEventListener("DOMContentLoaded", () => {
  updateCreditsDisplay();
});

// Modal logic for API Key and Custom Model management
document.addEventListener("DOMContentLoaded", function () {
  // API Key Modal
  const apiKeyButton = document.getElementById("apiKeyButton");
  const apiKeyModal = document.getElementById("apiKeyModal");
  const closeApiKeyModalBtn = document.getElementById("closeApiKeyModalBtn");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");

  if (apiKeyButton && apiKeyModal) {
    apiKeyButton.addEventListener("click", function () {
      apiKeyModal.style.display = "flex";
    });
  }
  if (closeApiKeyModalBtn && apiKeyModal) {
    closeApiKeyModalBtn.addEventListener("click", function () {
      apiKeyModal.style.display = "none";
    });
  }
  window.addEventListener("click", function (event) {
    if (event.target === apiKeyModal) {
      apiKeyModal.style.display = "none";
    }
  });
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener("click", function () {
      const openaiApiKey = document.getElementById("openaiApiKey").value;
      const geminiApiKey = document.getElementById("geminiApiKey").value;
      const claudeApiKey = document.getElementById("claudeApiKey").value;

      browserApi.storage.local.set(
        {
          openaiApiKey: openaiApiKey,
          geminiApiKey: geminiApiKey,
          claudeApiKey: claudeApiKey,
        },
        function () {
          // Show success message or visual feedback
          const originalText = saveApiKeyBtn.textContent;
          saveApiKeyBtn.textContent = "Saved!";
          saveApiKeyBtn.style.background =
            "linear-gradient(135deg, #10b981, #059669)";
          setTimeout(function () {
            saveApiKeyBtn.textContent = originalText;
            saveApiKeyBtn.style.background =
              "linear-gradient(135deg, #4f46e5, #7c3aed)";
            apiKeyModal.style.display = "none";
          }, 1500);
        }
      );
    });
  }

  // Custom Model Modal
  const addCustomModelBtn = document.getElementById("addCustomModelBtn");
  const customModelModal = document.getElementById("customModelModal");
  const closeCustomModelModalBtn = document.getElementById(
    "closeCustomModelModalBtn"
  );
  const saveCustomModelBtn = document.getElementById("saveCustomModelBtn");
  const customModelNameInput = document.getElementById("customModelName");
  const customModelEndpointInput = document.getElementById(
    "customModelEndpoint"
  );
  const customModelKeyInput = document.getElementById("customModelKey");
  let customModelError = null;

  if (customModelModal) {
    // Insert error message element if not present
    if (!customModelModal.querySelector('.error-message')) {
      const errDiv = document.createElement('div');
      errDiv.className = 'error-message';
      errDiv.id = 'customModelErrorMsg';
      customModelModal.querySelector('.modal-body').appendChild(errDiv);
    }
    customModelError = customModelModal.querySelector('.error-message');
  }

  if (addCustomModelBtn && customModelModal) {
    addCustomModelBtn.addEventListener("click", function () {
      customModelModal.style.display = "flex";
      if (customModelError) customModelError.style.display = 'none';
    });
  }
  if (closeCustomModelModalBtn && customModelModal) {
    closeCustomModelModalBtn.addEventListener("click", function () {
      customModelModal.style.display = "none";
      if (customModelError) customModelError.style.display = 'none';
    });
  }
  if (saveCustomModelBtn && customModelModal) {
    saveCustomModelBtn.addEventListener("click", function () {
      const name = customModelNameInput.value.trim();
      const endpoint = customModelEndpointInput.value.trim();
      const key = customModelKeyInput.value.trim();
      if (!name || !endpoint || !key) {
        if (customModelError) {
          customModelError.textContent = 'Please fill out all fields for the custom model.';
          customModelError.style.display = 'block';
        }
        return;
      }
      if (customModelError) customModelError.style.display = 'none';
      // Save to chrome.storage.sync
      browserApi.storage.sync.set(
        {
          customModel: {
            name: name,
            endpoint: endpoint,
            key: key,
          },
        },
        function () {
          if (browserApi.runtime.lastError) {
            console.error(
              "Error saving custom model:",
              browserApi.runtime.lastError
            );
            alert("Error saving custom model. Please try again.");
            return;
          }

          // Update model selector to include custom model
          if (modelSelect) {
            updateModelOptions(modelSelect, "custom");
            // Set custom as selected model
            modelSelect.value = "custom";

            // Save active model preference
            browserApi.storage.sync.set({ activeModel: "custom" });

            // Notify content script about model change
            browserApi.tabs.query(
              { active: true, currentWindow: true },
              function (tabs) {
                if (tabs[0]) {
                  browserApi.tabs
                    .sendMessage(tabs[0].id, {
                      action: "updateModel",
                      model: "custom",
                    })
                    .catch((err) =>
                      console.log(
                        "Could not notify content script about model change"
                      )
                    );
                }
              }
            );
          }

          // Show success message
          const originalText = saveCustomModelBtn.textContent;
          saveCustomModelBtn.textContent = "Saved!";
          saveCustomModelBtn.style.background =
            "linear-gradient(135deg, #10b981, #059669)";
          setTimeout(function () {
            saveCustomModelBtn.textContent = originalText;
            saveCustomModelBtn.style.background =
              "linear-gradient(135deg, #4f46e5, #7c3aed)";
            customModelModal.style.display = "none";
          }, 1500);
        }
      );
    });
  }

  // Add custom model to selector if exists
  browserApi.storage.sync.get("customModel", (data) => {
    if (data.customModel && modelSelect) {
      updateModelOptions(modelSelect, "custom", data.customModel.name);
    }
  });

  // Update model options to include custom model
  function updateModelOptions(select, plan, customModelName) {
    if (!select) return;
    select.innerHTML = "";
    select.appendChild(new Option("Gemini 2.5 Pro", "gemini"));
    select.appendChild(new Option("GPT-4", "gpt4"));
    select.appendChild(new Option("Claude", "claude"));
    if (plan === "custom" || customModelName) {
      select.appendChild(
        new Option(customModelName || "Custom Model", "custom")
      );
    }
  }
});

// Save model selection
document.getElementById("modelSelect").addEventListener("change", function () {
  saveSettings();
});

// Save command keyword
document.getElementById("commandInput").addEventListener("blur", function () {
  saveSettings();
});
