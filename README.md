# Daun Auto-Fill Extension

AI-powered form auto-fill Chrome extension for Daun Admin using OpenRouter AI vision models.

**Version:** 1.0.0
**License:** Private - Daun Internal Use Only
**Platform:** Chrome/Chromium (Manifest V3)

## Overview

Daun Auto-Fill Extension automates form filling on Daun Admin pages using AI-powered field analysis. Designed for QA testing and development workflows, it analyzes form screenshots and DOM structure to generate realistic test data.

### Key Features

- **AI-Powered Analysis**: Uses OpenRouter vision models (Gemini 2.0 Flash, GPT-4o Mini) to understand form context
- **Mantine Component Support**: Detects TextInput, Select, Checkbox, DatePicker, RichText, and more
- **Multi-Round Filling**: Retries unfilled fields up to 3 rounds with optional vision-based verification
- **Smart Field Detection**: Extracts labels from aria-label, associated labels, placeholders, and React props
- **Customizable**: Multi-API keys, custom prompts, domain whitelist, field type toggles
- **Developer-Friendly**: Keyboard shortcuts (Alt+F), debug mode with streaming AI output, visual feedback
- **Realistic Data**: Generates Korean business names, addresses, phone numbers matching Daun's domain

## Quick Start

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/khoipn21/autofill-extensions.git
   cd daun-autofill-extension
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Build the extension**

   ```bash
   bun run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder

### First-Time Setup

1. Click the extension icon in Chrome toolbar
2. Enter your OpenRouter API key ([get one free](https://openrouter.ai/keys))
3. Click "Test Connection" to verify
4. Select your preferred AI model (default: Gemini 2.0 Flash Free)
5. Navigate to any Daun Admin form
6. Click the purple "✨ Auto-Fill" button or press `Alt+F`

## Usage

### Basic Auto-Fill

1. **Navigate** to any Daun Admin form page
2. **Trigger** auto-fill:
   - Click the floating "✨ Auto-Fill" button (bottom-right), OR
   - Press `Alt+F` keyboard shortcut
3. **Wait** for AI analysis (2-5 seconds)
4. **Review** filled fields (green borders = success, red = failed)
5. **Retry** if needed - extension auto-retries failed fields up to 3 rounds

### Advanced Features

#### Multi-API Key Support

- **Settings → API Keys** - Add multiple OpenRouter API keys
- Automatic fallback on rate limits (429 errors)
- Set primary key for default usage

#### Custom Prompt Templates

- **Settings → Prompt Templates** - Create custom system prompts
- Customize AI behavior (e.g., "Focus on edge cases", "Use English names")
- Activate template to override default prompt

#### Field Type Filtering

- **Settings → Field Types** - Toggle which types to auto-fill
- Example: Disable "date" fields to manually enter specific dates
- Available types: text, number, date, select, checkbox, radio, switch, textarea, richtext, dynamic

#### Vision Recheck (Advanced)

- **Settings → Vision Recheck** - Enable screenshot analysis for retry rounds
- Takes fresh screenshot in Round 2+ to verify unfilled fields
- Increases accuracy but uses more API tokens

#### Debug Mode

- **Settings → Debug Mode** - Enable streaming AI output
- Real-time display of AI prompt and response
- Useful for troubleshooting fill failures

#### Custom Domains

- **Settings → Custom Domains** - Add additional whitelisted domains
- Example: Add `daun-demo.kr` for demo environments
- Default domains: localhost, 127.0.0.1, daun.kr, daun-dev.kr, daun-stg.kr, admin.daun.kr, etc.

## Supported Field Types

| Type         | Components                 | Fill Method                   | Notes                    |
| ------------ | -------------------------- | ----------------------------- | ------------------------ |
| **Text**     | TextInput, Textarea        | Direct input                  | Standard text fields     |
| **Number**   | NumberInput                | Direct input                  | Numeric values           |
| **Date**     | DateInput, DatePickerInput | Parse YYYY-MM-DD              | Auto-formats dates       |
| **Select**   | Select, Autocomplete       | Click → find option → click   | Searches dropdown        |
| **Checkbox** | Checkbox                   | Toggle checked state          | true/false values        |
| **Radio**    | Radio                      | Select option                 | Single choice from group |
| **Switch**   | Switch                     | Toggle on/off                 | Boolean values           |
| **RichText** | TipTap, Quill, ProseMirror | Insert HTML/text              | Supports formatting      |
| **Dynamic**  | Repeatable fields          | Add rows + fill               | Marketplace attributes   |
| **Popup**    | Category selectors         | Click trigger → navigate tree | Modal-based fields       |
| **File**     | FileInput                  | ⚠️ Skipped                    | Not supported            |

## Configuration

### Settings Overview

**Settings Page** (`chrome-extension://[id]/index.html#settings`)

| Section              | Options                                            | Description                         |
| -------------------- | -------------------------------------------------- | ----------------------------------- |
| **API Keys**         | Add/Remove/Test keys, Set primary                  | Multi-key support with fallback     |
| **Model Selection**  | Preset models, Custom model ID                     | Choose AI model or add custom       |
| **Field Types**      | Toggle checkboxes                                  | Enable/disable specific field types |
| **Advanced**         | Vision Recheck, Max Fill Rounds (1-10), Debug Mode | Fine-tune auto-fill behavior        |
| **Custom Domains**   | Add/Remove domains                                 | Extend whitelist beyond defaults    |
| **Prompt Templates** | Create/Edit/Activate templates                     | Customize AI prompt                 |
| **Language**         | Korean/English toggle                              | STG environment only                |

### Default Settings

```typescript
{
  apiKey: '',                              // Required on first use
  model: 'google/gemini-2.0-flash-exp:free', // Free tier model
  enabled: true,                           // Global enable
  enabledFieldTypes: ['text', 'number', 'date', 'select', ...], // All types
  enableVisionRecheck: false,              // Disabled (saves tokens)
  maxFillRounds: 3,                        // Max retry attempts
  debugMode: false,                        // No streaming output
  targetLanguage: 'kr'                     // Korean by default
}
```

## Development

### Tech Stack

| Category      | Technology         | Version | Purpose             |
| ------------- | ------------------ | ------- | ------------------- |
| **Build**     | Vite               | 7.x     | Popup bundler       |
|               | Bun                | 1.x     | Package manager     |
|               | TypeScript         | 5.9     | Type safety         |
| **UI**        | React              | 19.x    | Popup interface     |
|               | Tailwind CSS       | 4.x     | Styling             |
|               | Zustand            | 5.x     | State management    |
|               | Lucide React       | 0.5.x   | Icons               |
| **AI**        | OpenRouter API     | -       | Multi-model gateway |
| **Extension** | Chrome Manifest V3 | -       | Extension platform  |

### Project Structure

```
src/
├── background/        # Service worker (AI service, screenshot, storage)
├── content/           # Injected script (DOM analysis, form filling, UI overlay)
├── popup/             # React app (settings, manual control)
├── shared/            # Cross-context types and constants
└── utils/             # Logger, validators
```

### Scripts

```bash
# Development mode (popup hot reload)
bun run dev

# Build for production
bun run build

# Lint code
bun run lint

# Type check
bun run tsc -b
```

### Build Output

```
dist/
├── index.html           # Popup entry
├── assets/              # React app bundle (~150KB)
├── content.js           # Content script IIFE (~80KB)
├── background.js        # Service worker IIFE (~60KB)
├── manifest.json        # Extension manifest
└── icons/               # Extension icons
```

## Architecture

### Three-Context Design

**Popup** (React App)

- Settings UI, manual control
- Communicates via `chrome.runtime.sendMessage`

**Background** (Service Worker)

- AI API orchestration
- Screenshot capture
- Settings storage

**Content** (Injected Script)

- DOM analysis and field detection
- Form filling and visual feedback
- Floating action button and keyboard shortcuts

### Message Protocol

```typescript
type MessageType =
  | "GET_SETTINGS"
  | "SET_SETTINGS"
  | "TAKE_SCREENSHOT"
  | "ANALYZE_FORM"
  | "FILL_FORM"
  | "TRIGGER_AUTOFILL"
  | "TEST_CONNECTION"
  | "CANCEL_REQUEST"
  | "DEBUG_STREAM"
  | "CHANGE_LANGUAGE";

interface ExtensionMessage<T> {
  type: MessageType;
  payload?: T;
}

interface ExtensionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Auto-Fill Flow

```
User triggers (FAB or Alt+F)
  ↓
Analyze DOM fields (labels, types, selectors)
  ↓
Capture screenshot (visible tab)
  ↓
Send to OpenRouter AI (screenshot + field metadata)
  ↓
Parse JSON response (field ID → value mapping)
  ↓
Fill fields with appropriate methods
  ↓
Check for failures
  ↓
Retry failed fields (up to 3 rounds)
  ↓
Show success/failure toast
```

## Permissions

| Permission  | Purpose                               | Usage                           |
| ----------- | ------------------------------------- | ------------------------------- |
| `storage`   | Save API keys and settings            | `chrome.storage.local`          |
| `activeTab` | Access current tab for form detection | DOM queries                     |
| `scripting` | Inject content scripts                | Not currently used              |
| `tabs`      | Capture screenshots                   | `chrome.tabs.captureVisibleTab` |

**Host Permissions:**

- `*://*.daun.kr/*`
- `*://*.axndx.org/*`
- `*://localhost:*/*`
- `*://127.0.0.1:*/*`

## Security & Privacy

### Data Handling

- **API Keys**: Stored in `chrome.storage.local` (encrypted by browser), never logged
- **Screenshots**: Captured on-demand, sent to OpenRouter via HTTPS, not persisted
- **Form Data**: Only metadata (labels, types) sent to AI, no storage beyond session
- **Analytics**: None (no third-party tracking)

### Content Security Policy

- **CSP**: `script-src 'self'; object-src 'self'` (Manifest V3 default)
- **No inline scripts**, no `eval()`, no external scripts
- All code bundled at build time

## Troubleshooting

### FAB Button Not Appearing

**Possible Causes:**

- URL not in whitelist → Check console: "URL not in allowed domains"
- Extension disabled → Open popup, check "Enabled" toggle
- Content script not injected → Check Chrome DevTools > Sources > Content Scripts

### Form Fill Failures

**Possible Causes:**

- AI returned invalid JSON → Enable debug mode, check raw response
- Selector changed (Mantine update) → Re-run auto-fill, check console logs
- Element disabled/readonly → Check fill method classification

**Debug Steps:**

1. Enable **Settings → Debug Mode**
2. Trigger auto-fill
3. Check debug panel (bottom of page) for:
   - AI prompt sent
   - AI response received
   - Fill attempt logs

### API Connection Errors

**Possible Causes:**

- Invalid API key → Test connection in popup
- OpenRouter downtime → Check https://status.openrouter.ai
- Rate limit exceeded → Add alternative API key in settings
- Network firewall → Check browser console for CORS errors

## Limitations

### Current Constraints

- **Chrome Only**: Manifest V3 (no Firefox/Safari yet)
- **Mantine-Specific**: DOM selectors tuned for Mantine components
- **Single Tab**: Only works on active tab (not background tabs)
- **Vision Models**: Non-vision models can't analyze screenshots
- **File Uploads**: Not supported (always skipped)

### Known Issues

- Deeply nested popups may fail to detect
- Custom React components (non-Mantine) may not be detected
- Dynamic form updates after page load may be missed

## Roadmap

### Completed (v1.0.0)

- ✅ AI-powered form analysis with vision models
- ✅ Mantine component detection (10+ types)
- ✅ Multi-round retry logic with vision recheck
- ✅ Multi-API key support with fallback
- ✅ Custom prompt templates
- ✅ Debug mode with streaming output


## Contributing

For feature requests or bug reports, contact:

- GitHub Issues: https://github.com/khoipn21/autofill-extensions/issues

## License

KhoiPN21

**Copyright © 2026 KhoiPN21. All rights reserved.**

**Last Updated:** 2026-01-12
**Version:** 1.0.2
