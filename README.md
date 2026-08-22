# Deep-Browser 🌐⚡

> **Personal Local-First Browser Agent Workstation**

Deep-Browser transforms your local browser into an AI Agent Workstation. Built upon the robust foundation of **Browser Use** and integrating **BrowserCode**'s CDP in-process execution paradigm and **Desktop** multi-agent coordination, Deep-Browser gives you full supervisory control over autonomous browser agents running directly on your machine.

---

## ✨ Key Highlights

- **🔒 100% Local-First**: Zero mandatory cloud services. Runs directly on your machine against your local Chrome or isolated Chromium profiles.
- **🔌 Dual-Mode Browser Runtime**:
  - **Attached Mode**: Connects directly to your running Chrome (preserving logins, active tabs, and session cookies via CDP).
  - **Managed Mode**: Launches isolated profiles with discrete `user_data_dir` for concurrent tasks.
- **🛡️ Deterministic Verification Engine**: Every action (`type`, `click`, `navigate`, `submit`) is strictly verified against DOM mutations and runtime state. No false successes.
- **🧩 Chrome Extension MV3 Co-Pilot**: Access agents directly from the Chrome SidePanel, hand off your active tab, and view visual HUD overlays on pages.
- **🖥️ Workstation Agent IDE**: Real-time Action Timeline, Task Explorer, Live Browser Preview, Token/Latency Monitor, and Human-in-the-loop Safe Mode confirmations.
- **🤖 Model Agnostic**: First-class support for **Google Gemini**, **OpenAI**, **Anthropic**, **Ollama**, and any OpenAI-compatible local endpoint.

---

## 🏛️ Architecture

```
                       DEEP-BROWSER WORKSTATION
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   Chrome Extension         Companion Server         Agent IDE UI
   (SidePanel & HUD)        (FastAPI / WSS)       (Timeline & State)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                         DEEP-BROWSER ENGINE
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
    Task & Plan Graph       Supervisory Loop      Verification Engine
    (Milestone Tree)     (Observe-Think-Act)     (DOM State & Assertions)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                        BROWSER SESSION MANAGER
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
    Attached Chrome                               Managed Profiles
(Existing Port 9222 / Session)             (Isolated Profile A, B, C...)
```

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Fadhlijeu/deep-browser.git
cd deep-browser

# Install Python package in editable mode
pip install -e .
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Choose your preferred LLM
DEEP_BROWSER_LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key

# Or OpenAI / Anthropic / Ollama:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# OLLAMA_BASE_URL=http://localhost:11434/v1
```

### 3. Start Companion Server & Workstation UI

```bash
deep-browser serve --port 8765
```

Open [http://localhost:8765](http://localhost:8765) in your browser to launch the Workstation IDE.

### 4. Load the Chrome Extension (Optional & Recommended)

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `extension/` directory in this repository.
4. Click the Deep-Browser icon in your toolbar or open the **SidePanel**!

---

## 📁 Project Structure

```
deep-browser/
├── docs/                     # 25+ Comprehensive architectural documents & ADRs
├── extension/                # Chrome Extension Manifest V3 (SidePanel, HUD, Worker)
├── src/
│   └── deep_browser/         # Core Python Engine
│       ├── agent/            # Supervisory Agent Loop & prompts
│       ├── browser/          # CDP Runtime, Attached & Managed Sessions
│       ├── dom/              # DOM extraction, accessibility tree & selectors
│       ├── llm/              # Multi-provider LLM router
│       ├── models/           # Pydantic schemas (Task, Action, Evidence)
│       ├── server/           # FastAPI + WebSocket companion server
│       ├── tools/            # Browser action registry & controller
│       ├── verification/     # Deterministic action verification rules
│       ├── web/              # Premium Agent IDE Web UI assets
│       ├── cli.py            # CLI entry point
│       └── config.py         # App configuration
├── tests/                    # Unit, integration, and E2E golden tests
├── workspace/                # Local runtime data (tasks, artifacts, scripts, logs)
├── AGENTS.md                 # Agent architectural invariants & guidelines
├── LICENSE                   # MIT License
└── THIRD_PARTY_NOTICES.md    # Upstream provenance (Browser Use, BrowserCode, Desktop)
```

---

## ⚖️ License & Provenance

Deep-Browser is licensed under the [MIT License](LICENSE).
Portions and architectural concepts are derived from [Browser Use](https://github.com/browser-use/browser-use), [BrowserCode](https://github.com/browser-use/browsercode), and [Browser Use Desktop](https://github.com/browser-use/desktop). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full provenance and attribution.
