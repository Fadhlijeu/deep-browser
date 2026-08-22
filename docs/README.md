# Deep-Browser Documentation

Welcome to **Deep-Browser** — a local-first browser agent platform and desktop workstation built as a fork and rework of the Browser Use ecosystem.

---

## Architecture Overview

```
                      DEEP-BROWSER
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      DESKTOP SOFTWARE            CHROME EXTENSION
       (FULL VERSION)              (LIGHT VERSION)
   Multi-Agent Workstation         In-Browser SidePanel
   • Embedded Browser Slots        • Active Tab Control
   • Session SQLite Database       • Interactive Safe Mode Gate
   • Multi-Engine Spawner          • Direct WebSocket Client
             │                           │
             └─────────────┬─────────────┘
                           ▼
               SHARED AGENT RUNTIME & BRIDGE
                 • browser_use Core Engine
                 • SafeModePolicy Gateway
                 • EventBroadcaster
```

---

## Core Components
1. **Desktop Software (`app/`)**: Full multi-agent workstation for Windows, macOS, and Linux powered by Electron, Vite, and React 19.
2. **Core Agent Library (`browser_use/`)**: Local-first browser automation engine communicating via CDP and Playwright.
3. **Product Policy & Bridge (`deep_browser/`)**: Deterministic verification, interactive Safe Mode confirmation gateway, and WebSocket event bridge.
4. **Companion Chrome Extension (`extension/`)**: Lightweight in-browser SidePanel interface connecting directly to the running agent engine.

---

## Quick Start
- **Desktop Application**:
  ```bash
  cd app
  npm run dev
  ```
- **Companion Extension Bridge**:
  ```bash
  uvicorn deep_browser.bridge.server:app --host 127.0.0.1 --port 8765
  ```
- **Chrome Extension**: Load the unpacked extension from `extension/` into Chrome at `chrome://extensions/`.
