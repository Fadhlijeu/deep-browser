# Deep-Browser 🌐⚡

> **Local-First Browser Agent Desktop Application & Chrome Companion**

**Deep-Browser** is an autonomous browser-agent platform built upon the **Browser Use** core engine and **Browser Use Desktop** architecture. It provides a full-featured desktop workstation along with an in-browser companion extension, powered by **Google Gemini** for fast, reliable, local-first web automation.

---

## 🏛️ System Architecture

Deep-Browser provides a unified experience across two complementary interfaces sharing a single authoritative Browser Use runtime:

```
                          DEEP-BROWSER
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
    DESKTOP APPLICATION                  CHROME EXTENSION
       (FULL VERSION)                     (LIGHT VERSION)
   • Multi-session SQLite database     • In-browser SidePanel companion
   • Embedded browser slots via CDP    • Active tab handoff & control
   • Multi-engine adapter hub          • Live event stream & HUD overlay
   • Native background orchestration   • Interactive Safe Mode modal
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                   SHARED AGENT RUNTIME & CORE
            ┌─────────────────────────────────────────┐
            │ • browser_use Core Engine               │
            │ • Google Gemini (Primary AI Provider)   │
            │ • Interactive Safe Mode Policy Gate     │
            │ • Fast Event Broadcaster Bridge         │
            └─────────────────────────────────────────┘
```

---

## ✨ Features

- **🔒 100% Local-First**: Operates against your local Chromium/Chrome instances without mandatory third-party cloud browser locks.
- **⚡ Google Gemini Default**: Native integration with Google Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`) using `GOOGLE_API_KEY`.
- **🖥️ Full Desktop Workstation (`app/`)**: Electron + Vite + React desktop software featuring session timelines, logs, and terminal integration.
- **🧩 In-Browser Companion (`extension/`)**: Manifest V3 SidePanel extension to monitor and control tasks directly in Google Chrome.
- **🛡️ Interactive Safe Mode**: High-risk browser actions (purchases, destructive deletes, form submissions) require human confirmation before dispatch.
- **🔌 Multi-Browser Support**: Seamlessly switch between Attached Mode (your active Chrome) and Managed Mode (isolated user profiles).

---

## 🚀 Quick Start

### 1. Configure Gemini API Key
Copy the template `.env.example` to `.env`:
```bash
GOOGLE_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### 2. Launch Desktop Application (Full Version)
```bash
cd app
npm install --legacy-peer-deps
npm run dev
```

### 3. Load Chrome Extension Companion (Light Version)
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension/` folder.
4. Open the Deep-Browser SidePanel in Chrome.

---

## 📁 Repository Structure

```
deep-browser/
├── app/                  # Deep-Browser Desktop Application (Electron + Vite + React)
├── browser_use/          # Upstream Browser Use core library & agent engine
├── deep_browser/         # Deep-Browser bridge, Safe Mode policy & event broadcaster
│   ├── bridge/           # WebSocket & HTTP companion server for Chrome Extension
│   ├── events/           # Unified agent event contracts
│   ├── policies/         # Safe Mode interactive confirmation gateway
│   └── sessions/         # Multi-session coordinator
├── extension/            # Chrome Extension Manifest V3 companion (SidePanel)
├── docs/                 # Baseline verification and architecture documentation
├── shared/               # Shared JSON schemas for tasks and sessions
└── THIRD_PARTY_NOTICES.md # Upstream licenses and attribution (MIT)
```

---

## 📜 License & Attribution

Deep-Browser is licensed under the [MIT License](LICENSE).
Third-party licenses, copyright notices, and upstream provenance for Browser Use and Browser Use Desktop are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
