# TypePilot (Firefox Build)

A powerful Chrome extension that provides AI assistance directly in your browser. TypePilot allows users to interact with various AI models including Gemini 2.5 Pro, GPT-4, and Claude through any of there browser tabs. This version of TypePilot is tweaked specifically for compatibility with Mozilla Firefox.

![TypePilot Logo](icons/logo.png)

## Index
- [Features](#features)
- [Installation](#installation)
- [API Keys](#api-keys)
- [Custom models](#custom-models)
- [Project structure](#project-structure)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- **Multiple AI Model Support**: Choose between Gemini 2.5 Pro, GPT-4, Claude, or add your own custom model
- **Custom Command Keyword**: Personalize your trigger keyword for AI assistance (default: "help:")
- **Privacy-Focused**: API keys are stored only in your browser and never sent to our servers

## Installation
Method 1: Temporary addon (For testing purposes)
>[!CAUTION]
> This method of installing TypePilot is not recommended as certain details or data won't be stored in your device.
1. Clone the repo using
   ```bash
   git clone https://github.com/neumaz66/TypePilotFirefox
   ```
2. Go to about:debugging in Mozilla Firefox
3. Go to "This Device" section from the sidebar on the left
4. Click on "Load Temporary Add-on" button
5. Select the ***manifest.json*** only from the cloned folder.
6. Click on Open
7. Now you can access the extension like how you would normally do from the extension menu.

>[!WARNING]
> On closing firefox, the extension will be unloaded and some data might disappear. Use for testing only


### API Keys

TypePilot requires API keys for the AI models you want to use:

- **Gemini**: Get your API key from [Google AI Studio](https://makersuite.google.com/)
- **GPT-4**: Get your API key from [OpenAI](https://platform.openai.com/)
- **Claude**: Get your API key from [Anthropic](https://console.anthropic.com/)

### Custom Models

You can also add your own custom model by providing:

- Model name
- API endpoint
- API key

  To do this:
  1. Open the extension popup
  2. Select "Add Custom Model"
  3. Provide the details you obtained (Any model name, API endpoint and the specific API key)
  4. Click save
  5. Now you can select your own custom model from the AI model dropdown list

## Project Structure

- `manifest.json`: Extension configuration
- `background.js`: Background service worker for handling authentication and API requests
- `content.js`: Content script for detecting command keywords on webpages
- `popup.html`: Main extension popup interface
- `popup.js`: JavaScript for the popup functionality
- `popup-state.js`: Manages login state and UI transitions
- `components/`: Contains modular components like login and registration forms
- `styles/`: CSS styling for the extension


## Security

TypePilot takes your privacy seriously:

- API keys are stored only in your browser using Chrome's secure storage API
- Keys are never sent to our servers
- Custom models and configurations are stored locally

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Contact

- (Dev-devadath) Page: https://devadath.co
- (Neumaz66) Page: https://neumaz66.github.io/portfolio (Scroll down to the bottom and click the mail-to icon)

## For Chrome version
 [TypePilot Chrome-based builds](https://github.com/Dev-devadath/TypePilot)
