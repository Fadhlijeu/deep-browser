# Deep-Browser

<p align="center">
  <strong>AI browser copilot for desktop and Chrome.</strong><br>
  Delegate multi-step web tasks in natural language, inspect agent activity, and keep sensitive actions under human control.
  <br><br>
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-5B8C5A" alt="MIT License">
</p>

## Agent demo

<p align="center">
  <img src="docs/images/agent-demo.gif" alt="Simulated Deep-Browser agent demo showing reasoning, tool calls, verification, and a final summary" width="960">
  <br>
  <sub>Simulated showcase only — prompt, reasoning, tool results, and verification data are demo fixtures, not a live browser run.</sub>
</p>

## Interface

| **Dark theme** | **White theme** |
|:---:|:---:|
| <img src="docs/images/chatbot-full-dark.png" alt="Deep-Browser full interface in near-black theme" width="100%"> | <img src="docs/images/chatbot-full-light.png" alt="Deep-Browser full interface in white theme" width="100%"> |

**Chrome Side Panel · High-resolution capture**

<p align="center">
  <img src="docs/images/chatbot-sidepanel-dark.png" alt="Deep-Browser compact Chrome side panel in near-black theme" width="420">
</p>

## Features

- **Natural-language tasks** — delegate multi-step browser workflows through chat.
- **Execution visibility** — inspect reasoning display, tool calls, event logs, and verification status.
- **Human approval** — keep sensitive actions behind explicit review gates.
- **Desktop + Chrome** — Electron workstation and Chrome Manifest V3 side panel.
- **Model configuration** — Gemini by default, with optional OpenAI, Anthropic, and Ollama settings.

## Tech stack

**Agent runtime:** Python · Browser Use · FastAPI · WebSockets  
**Desktop:** Electron · React · TypeScript · SQLite  
**Extension:** Chrome Manifest V3 · React · TypeScript

## Quick start

### 1. Configure the API key and start the local bridge

Requires Python 3.11+ and a Google Gemini API key.

```bash
git clone https://github.com/Fadhlijeu/deep-browser.git
cd deep-browser
cp .env.example .env
# Add your key as GOOGLE_API_KEY in .env

python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1

python -m pip install -e .
uvicorn deep_browser.bridge.server:app --host 127.0.0.1 --port 8765
```

### 2. Build and load the Chrome extension

```bash
npm ci --prefix extension
npm run build --prefix extension
```

Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the `extension/` folder.

### 3. Run the desktop app (optional)

Requires Node.js 20+.

```bash
npm install --prefix app --legacy-peer-deps
npm run dev --prefix app
```

Browser control runs locally; prompts are sent to the configured AI provider. Avoid entering sensitive information into untrusted websites.

## License

MIT — see [LICENSE](LICENSE). Third-party licenses and upstream attribution are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
