# Deep-Browser

<p align="center">
  <strong>AI browser copilot for desktop and Chrome.</strong><br>
  Delegate multi-step web tasks, follow execution in real time, and keep sensitive actions under human control.
  <br><br>
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-5B8C5A" alt="MIT License">
</p>

<p align="center">
  <img src="docs/images/chatbot-demo.gif" alt="Animated tour of the Deep-Browser interface" width="920">
  <br>
  <sub>UI demo: chat, execution inspector, sessions, activity, and command palette.</sub>
</p>

## Interface

**Full workspace · Near-black theme**

<p align="center">
  <img src="docs/images/chatbot-full-dark.png" alt="Deep-Browser full workspace in near-black theme" width="100%">
</p>

**Chrome Side Panel · Compact layout**

<p align="center">
  <img src="docs/images/chatbot-sidepanel-dark.png" alt="Deep-Browser running in a narrow Chrome side panel viewport" width="380">
</p>

## Capabilities

- **Natural-language browser tasks** — hand off multi-step workflows through a chat interface.
- **Live execution visibility** — inspect tool steps, event logs, execution status, and verification details.
- **Human approval gates** — keep sensitive actions behind an explicit review step.
- **Desktop + Chrome** — use the Electron workstation or the Manifest V3 side panel.
- **Flexible model setup** — Gemini is the default; optional provider settings include OpenAI, Anthropic, and Ollama.

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

In a second terminal, from the repository root:

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
