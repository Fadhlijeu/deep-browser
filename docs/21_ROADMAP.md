# 21. Phased Product Roadmap

## 🗺️ Release Phases

### Phase 1: Core Fork, Extension & Deterministic Verification (v0.1.0) - Completed
- Fork and integration of upstream `browser-use` core (`85ddbfedf609166b2d2c76c3d80506649fee82a9`).
- Deep-Browser product layer (`deep_browser/`):
  - Local companion FastAPI + WebSocket server (`ws://127.0.0.1:8765/ws`).
  - Structured timeline event stream broadcaster (`deep_browser.events`).
  - Deterministic verification engine wrapping actions (`deep_browser.verification`).
  - Safe Mode policy & confirmation gateways (`deep_browser.policies`).
  - Workspace storage manager for tasks, artifacts, and traces (`deep_browser.workspace`).
- Chrome Extension MV3 with SidePanel dock and real-time streaming HUD.
- Live in-process browser execution tests verified (63/63 tests passing).

### Phase 2: Interactive Safe Mode & In-Page Scripting (v0.2.0) - Next
- Interactive confirmation modal in Chrome Extension SidePanel when encountering sensitive actions.
- In-page script execution (`browser_execute`) adopting BrowserCode patterns for zero-shot reusable tasks in `workspace/scripts/`.
- Extended multi-tab session coordination via `MultiBrowserCoordinator`.

### Phase 3: Desktop Multi-Agent Orchestration (v0.3.0)
- Synthesis of Browser Use Desktop patterns for managing parallel agent teams.
- Session grid preview thumbnails and CPU/RAM concurrency throttling.
- Step-back action replay and offline evidence inspection.
