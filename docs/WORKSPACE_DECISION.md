# Deep-Browser Workspace Strategy & Architectural Decision

**Status**: Approved & Frozen  
**Document**: `docs/WORKSPACE_DECISION.md`  
**Milestone**: Milestone 3 — Workspace Integration / Decision Gate  
**Reference Commit**: `6b00ab9` (Post-Milestone 4 Safe Mode Gate)

---

## 1. Executive Summary & Ecosystem Evaluation

The purpose of this architectural decision is to formally evaluate the projects in the `browser-use` ecosystem, prevent redundant implementations, and define the definitive workspace, runtime, and user interface strategy for **Deep-Browser**.

### Ecosystem Evaluation Summary

| Project | Ecosystem Role & Tech Stack | Evaluation for Deep-Browser | Decision |
| :--- | :--- | :--- | :--- |
| **`browser-use/browser-use`** | **Primary Agent Core**<br>• Python 3.11+, Pydantic v2, direct CDP bindings<br>• `Agent`, `BrowserSession`, `BrowserProfile`, `Tools`, `DomService`, LLM adapters | **PRIMARY CORE FOUNDATION**<br>The sole automation and agent reasoning engine. All features are built by modifying, wrapping, or extending `browser_use/` directly in the repository root. | **ADOPT AS PRIMARY CORE** |
| **`browser-use/browsercode`** | **Scripting Agent Framework**<br>• TypeScript/Node.js CLI + TUI<br>• Writes and executes raw JS/CDP scripts instead of atomic tool calls | **REFERENCE ONLY (Script Execution Idea)**<br>Valuable paradigm for executing batch JS scripts via CDP (`evaluate`), but Python `browser_use` remains our core. Do NOT recreate a TypeScript sandbox or duplicate agent loop. | **DO NOT DUPLICATE** (Adopt scripting concepts via native CDP `evaluate`) |
| **`browser-use/desktop`** | **Standalone Desktop GUI Client**<br>• Electron + TypeScript + CDP<br>• Manages isolated windows and cookie persistence | **REDUNDANT CONTAINER**<br>Creating a separate Electron window forces the user out of their actual browser. Deep-Browser is local-first and lives *inside* the user's Chrome browser via an MV3 SidePanel and attached CDP port 9222. | **REJECT ELECTRON APP** (Extension SidePanel is superior) |
| **`browser-use/web-ui`** | **Basic Gradio Demo Web UI**<br>• Python + Gradio (`webui.py`)<br>• Single-prompt launcher and screenshot viewer | **REFERENCE ONLY**<br>Gradio is a demo harness, not a modern agent workstation or multi-session IDE. Deep-Browser must NOT build or copy a Gradio interface. | **REJECT GRADIO UI** |

---

## 2. Definitive Answers to the 10 Core Architectural Questions

### 1. What is the primary runtime?
**The primary runtime is Python `browser_use/` directly in the repository root, enhanced by the `deep_browser` product layer.**
- Python 3.11+ async execution environment with direct Chrome DevTools Protocol (CDP) and Playwright bindings.
- Zero cloud runtime lock-in (no mandatory Browserbase or Browser Use Cloud).
- Operates locally against user Chrome or isolated Chromium binaries with support for local LLMs (Ollama/vLLM) and external LLM APIs (Gemini, OpenAI, Anthropic).

### 2. What is the primary workspace?
**The primary workspace is the unified local disk workspace managed by `deep_browser.workspace.manager.WorkspaceManager` in `workspace/`.**
- Task journals, structured step logs, and replay traces (`workspace/tasks/`).
- Captured DOM trees, accessibility trees, and screenshots (`workspace/snapshots/`).
- Agent-generated file artifacts, exports, and downloads (`workspace/artifacts/`).
- Deep-Browser does NOT build a complex fifth cloud workspace; local filesystem persistence provides transparent, deterministic inspection.

### 3. What is the primary user interface?
**The primary user interface is the Deep-Browser Chrome Extension MV3 (SidePanel + In-Page HUD Overlay).**
- **Zero Context Switch**: Sits directly docked to the user's active browser window.
- **SidePanel (`extension/sidepanel/`)**: Houses the real-time timeline event stream, prompt input, mode toggles (Attached vs. Managed), session switcher, and the interactive Safe Mode confirmation modal.
- **HUD Overlay (`extension/content/`)**: Injects live bounding-box overlays, element highlight boxes, and agent progress badges directly over target DOM nodes.
- **Companion CLI (`deep_browser/cli.py`)**: Secondary developer interface for headless script execution and terminal workflows.

### 4. What should come from Browser Use core?
**All foundational browser automation, DOM indexing, CDP communications, and agent reasoning loops:**
- **`browser_use.agent.service.Agent`**: The multi-step reasoning, memory management, prompt formatting, and token budgeting loop.
- **`browser_use.browser.session.BrowserSession`**: CDP session lifecycle, target attach/detach, viewport sizing, and cookie/storage management.
- **`browser_use.browser.profile.BrowserProfile`**: Chromium binary discovery, launch arguments, and proxy configuration.
- **`browser_use.dom.service.DomService`**: Accessibility-tree parsing, visual bounding-box calculations, and interactive selector indexing.
- **`browser_use.tools.service.Tools`**: Canonical browser actions (`navigate`, `click`, `input`, `scroll`, `send_keys`, `evaluate`, `select_dropdown`, `screenshot`, etc.).
- **`browser_use.llm`**: Multi-provider LLM client wrappers.

### 5. What should come from BrowserCode?
**The philosophy of high-leverage script evaluation, without adopting its TypeScript runtime:**
- Use Browser Use's native `evaluate` action to execute deterministic JavaScript snippets directly in page context via CDP when multiple DOM queries or compound operations are needed.
- Do NOT rewrite Deep-Browser in TypeScript or duplicate BrowserCode's TUI.

### 6. What should come from Desktop/Web UI?
**Cookie synchronization and session persistence patterns only:**
- Adopt the technique from Desktop of reading and injecting local Chrome cookies/storage into isolated browser profiles for authenticated workflows.
- Do NOT adopt Electron windowing or Gradio UI wrappers.

### 7. What should remain Deep-Browser-specific?
**The high-reliability enterprise product layer residing in `deep_browser/`:**
1. **Interactive Safe Mode Gateways (`deep_browser.policies.safety`)**: Deterministic policy evaluating sensitive actions (`SUBMIT`, `SEND`, `DELETE`, `PURCHASE`, `PUBLISH`, `ACCOUNT_CHANGE`), pausing execution, and requiring Chrome Extension confirmation.
2. **Deterministic Verification Layer (`deep_browser.verification`)**: Pre/post action validation asserting real DOM mutations before declaring success ("Never Executed == Success").
3. **Event Stream Broadcaster & Bridge Server (`deep_browser.bridge` & `deep_browser.events`)**: FastAPI + bidirectional WebSocket bridge on `127.0.0.1:8765` broadcasting real-time timeline events to the Chrome Extension.
4. **Multi-Session Coordinator (`deep_browser.sessions`)**: Managing Attached Mode (port 9222) vs Managed Mode across parallel BrowserSessions.
5. **Workspace Storage Manager (`deep_browser.workspace`)**: Task journals, trace replays, and artifact persistence.

### 8. What should NOT be implemented because Browser Use already provides it?
- **NO duplicate `Agent` loop**: Deep-Browser must not write a parallel `while not done` execution engine.
- **NO duplicate `BrowserSession`**: Deep-Browser must not write a custom CDP connection pool or Playwright wrapper.
- **NO duplicate `Tools`**: Deep-Browser must not create custom click/input/navigate functions; use `browser_use.Tools` or wrap them in `SafeTools`.
- **NO duplicate `DomService`**: Deep-Browser must not create a custom DOM parser or coordinate calculator.
- **NO custom standalone browser dashboard / web workstation**: The Chrome Extension SidePanel is the official UI.

### 9. How does the Chrome Extension interact with the selected workspace/runtime?
1. **Transport**: Chrome Extension connects to the local companion server at `ws://127.0.0.1:8765/ws/extension`.
2. **Task Dispatch**: User submits a task in the SidePanel $\to$ bridge creates and runs a `browser_use.Agent` with `SafeTools`.
3. **Live Streaming**: Every step, thought, DOM observation, action, and verification result is emitted over WebSocket to the SidePanel timeline.
4. **Safe Mode Interception**: When a sensitive action is proposed, `SafeTools` emits `CONFIRMATION_REQUIRED` $\to$ SidePanel displays the modal $\to$ user clicks `[ Confirm ]` / `[ Reject ]` $\to$ decision returned over WebSocket to resolve the pending action.
5. **HUD Highlights**: When an action targets an element index, extension content scripts render live bounding-box highlights over the actual DOM element.

### 10. How should parallel browser sessions be exposed?
- Managed via `deep_browser.sessions.coordinator.SessionCoordinator` coordinating independent `browser_use.BrowserSession` instances.
- **Attached Mode**: Connects to the user's primary Chrome instance on `--remote-debugging-port=9222` to automate active tabs.
- **Managed Mode**: Spawns isolated Chromium instances with separate `BrowserProfile` directories to avoid state leakage.
- **Extension UX**: A session switcher in the SidePanel header allows the user to monitor or toggle focus between active sessions without cluttering the screen with multiple standalone windows.

---

## 3. Milestone 3 Scope & Execution Policy

```
                               THE PRINCIPLE INVARIANT
                               
                       "Does Browser Use already provide this?"
                                     │
                    ┌────────────────┴────────────────┐
                   YES                                NO
                    │                                 │
           Use Browser Use Core            "Does BrowserCode/Desktop
             (browser_use/)                    already provide it?"
                                                      │
                                             ┌────────┴────────┐
                                            YES                NO
                                             │                 │
                                       Reuse/Adapt      Implement new
                                         Pattern        Deep-Browser code
                                                        (deep_browser/)
```

### Milestone 3 Implementation Scope (Finalized)
1. **Decision Gate Documentation**: Create and commit `docs/WORKSPACE_DECISION.md` (this document).
2. **Roadmap & Architecture Synchronization**: Update `docs/02_ARCHITECTURE.md`, `docs/21_ROADMAP.md`, and `docs/22_PROGRESS.md` to reflect the frozen workspace strategy.
3. **No Fifth Workspace**: Explicitly close Milestone 3 with zero duplicate web IDE / dashboard code.
4. **Transition to Milestone 5**: Advance roadmap to **Milestone 5: Multi-Browser Profile & Attached Session Coordination**.
