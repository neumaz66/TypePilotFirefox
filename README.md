# TypePilot

A powerful Chrome extension that provides AI assistance directly in your browser. TypePilot allows users to interact with various AI models including Gemini 2.5 Pro, GPT-4, and Claude through any of there browser tabs.

![TypePilot Logo](icons/logo.png)

## Features

- **Multiple AI Model Support**: Choose between Gemini 2.5 Pro, GPT-4, Claude, or add your own custom model
- **Custom Command Keyword**: Personalize your trigger keyword for AI assistance (default: "help:")
- **Privacy-Focused**: API keys are stored only in your browser and never sent to our servers

## How It Works

1. Install the TypePilot extension
2. Configure your preferred AI model and API keys
3. Type your custom command (default: "help:") followed by your query in any text field on the web
4. The AI will process your request and provide a response directly where you're typing

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The TypePilot extension should now be installed and visible in your browser toolbar

## Configuration

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

## Project Structure

- `manifest.json`: Extension configuration
- `background.js`: Background service worker for handling authentication and API requests
- `content.js`: Content script for detecting command keywords on webpages
- `popup.html`: Main extension popup interface
- `popup.js`: JavaScript for the popup functionality
- `popup-state.js`: Manages login state and UI transitions
- `components/`: Contains modular components like login and registration forms
- `styles/`: CSS styling for the extension

## Development

The extension is built using:

- Manifest V3
- Vanilla JavaScript
- Chrome Extension APIs
- Supabase for backend authentication and data storage


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

- Page: https://devadath.co
