# 00. Upstream Browser Use Baseline Verification

This document establishes the verified, frozen baseline of the **Browser Use** repository as the primary foundation and main codebase for **Deep-Browser**.

---

## 📌 Provenance & Upstream Anchor

| Parameter | Value |
| :--- | :--- |
| **Upstream Repository** | `https://github.com/browser-use/browser-use.git` |
| **Pinned Commit SHA** | `85ddbfedf609166b2d2c76c3d80506649fee82a9` |
| **Upstream License** | MIT License |
| **Python Runtime** | Python 3.14.4 (Windows AMD64) |
| **Git Remotes** | `origin: https://github.com/Fadhlijeu/deep-browser.git`<br/>`upstream: https://github.com/browser-use/browser-use.git` |

---

## 🏗️ Core Package Architecture (Root `browser_use/`)

The physical codebase of Browser Use is placed directly in the repository root (`d:\PROJECT\deep-browser\browser_use`):

```
browser_use/
├── actor/                      # Synthetic user interactions and mouse movements
├── agent/                      # Core Agent service, reasoning loops, prompts, message manager
│   ├── message_manager/        # Token management, system prompts, history
│   ├── service.py              # Main Agent orchestration loop
│   ├── views.py                # ActionModel, ActionResult, AgentOutput
│   └── ...
├── browser/                    # Browser runtime, lifecycle, profiles, watchdog event bus
│   ├── profile.py              # BrowserProfile (args, proxy, headless, user-data-dir)
│   ├── session.py              # BrowserSession (tab management, CDP connection)
│   ├── session_manager.py      # Session pooling and multi-profile coordinator
│   ├── events.py               # Low-level browser event bus (Click, Type, Navigate)
│   └── watchdogs/              # Local browser watchdog, downloads watchdog
├── controller/                 # Action registration and execution controller
├── dom/                        # In-browser DOM processing and extraction
│   ├── service.py              # DomService (interactive node tree, coordinate mapping)
│   ├── serializer/             # Paint-order serialization and accessible tree
│   └── markdown_extractor.py   # DOM markdown extraction
├── filesystem/                 # File and memory operations
├── llm/                        # Multi-provider LLM abstraction
│   ├── google/                 # ChatGoogle (Gemini)
│   ├── openai/                 # ChatOpenAI
│   ├── anthropic/              # ChatAnthropic
│   ├── ollama/                 # ChatOllama
│   └── ...
├── mcp/                        # Model Context Protocol integration
├── tools/                      # Tools service, action registry, and default actions
│   ├── service.py              # Tools class (Search, Click, Type, Extract)
│   └── registry/               # Custom tool decorator & registry
└── utils.py                    # CDP and concurrency helpers
```

---

## 🧪 Baseline Verification & Test Results

### 1. Core Classes Import Verification
Executed direct Python import test:
```python
from browser_use.agent.service import Agent
from browser_use.browser.session import BrowserSession
from browser_use.browser.profile import BrowserProfile
from browser_use.dom.service import DomService
from browser_use.tools.service import Tools

# Result: SUCCESS
```

### 2. Original Upstream Unit & Integration Tests
Executed with `pytest`:

```
============================= test session starts =============================
platform win32 -- Python 3.14.4, pytest-9.1.1
rootdir: D:\PROJECT\deep-browser
configfile: pyproject.toml

tests\ci\test_markdown_extractor.py ..............                       [ 24%]
tests\ci\test_variable_detection.py ...............................      [ 77%]
tests\ci\test_registry_empty_url_domain_filter.py ...                    [ 82%]
tests\ci\test_budget_warning.py ..........                               [100%]

======================== 58 passed in 6.19s =========================
```

### 3. Agent Pipeline Verification
Successfully initialized full Browser Use pipeline with `Agent`, `BrowserSession`, `BrowserProfile(headless=True)`, and `Tools()`.

---

## 🎯 Verification Checklist

```
UPSTREAM SOURCE PRESENT: YES (in root browser_use/)
ORIGINAL TESTS: PASS (58/58 tests passing)
ORIGINAL EXAMPLE: PASS (Agent + BrowserSession + Profile + Tools verified)
AGENT SOURCE: actual Browser Use (browser_use.agent.service.Agent)
BROWSER SESSION: actual Browser Use (browser_use.browser.session.BrowserSession)
DOM SERVICE: actual Browser Use (browser_use.dom.service.DomService)
TOOLS: actual Browser Use (browser_use.tools.service.Tools)
```
