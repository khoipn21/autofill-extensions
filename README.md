# Daun Auto-Fill Extension

AI-powered form auto-fill extension for Daun Admin using OpenRouter AI.

## Features

- **AI-Powered Auto-Fill**: Uses OpenRouter vision models to understand form context and generate appropriate values
- **DOM Analysis**: Detects Mantine form components and extracts labels
- **Screenshot Integration**: Captures page screenshot for visual context analysis
- **Floating Action Button**: Quick access auto-fill button on every Daun Admin page
- **Keyboard Shortcut**: Press `Alt+F` to trigger auto-fill

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the extension:
   ```bash
   bun run build
   ```
4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. Click the extension icon
2. Enter your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))
3. Select your preferred AI model
4. Navigate to any Daun Admin form
5. Click the floating action button or press `Alt+F` to auto-fill

## Development

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Build for production
bun run build

# Lint code
bun run lint
```

## Tech Stack

- **Build**: Vite 7
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **AI**: OpenRouter API (Gemini Flash 1.5 default)

## Permissions

- `storage`: Save API key and settings
- `activeTab`: Access current tab for form detection
- `scripting`: Inject content scripts
- `tabs`: Capture screenshots

## License

Private - Daun Internal Use Only
