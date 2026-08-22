# 21. Phased Product Roadmap

## 🗺️ Release Phases

### Phase 1: Core Fork, Extension & Deterministic Verification (v0.1.0) - Completed
- Fork and integration of upstream `browser-use` core (`85ddbfedf609166b2d2c76c3d80506649fee82a9`).
- Deep-Browser product layer (`deep_browser/`):
  - Local companion FastAPI + WebSocket server (`ws://127.0.0.1:8765/ws`).
  - Structured timeline event stream broadcaster (`deep_browser.events`).
  - Deterministic verification engine wrapping actions (`deep_browser.verification`).
  - Safe Mode policy & confirmation models (`deep_browser.policies`).
  - Workspace storage manager for tasks, artifacts, and traces (`deep_browser.workspace`).
- Chrome Extension MV3 with SidePanel dock and real-time streaming HUD.
- Live in-process browser execution tests verified (63/63 tests passing).

### Phase 2: Interactive Safe Mode Confirmation Gateways (v0.2.0) - Next Target
- Interactive confirmation modal in Chrome Extension SidePanel when encountering sensitive/destructive actions (*delete, pay, submit, transfer*).
- Full pause-and-yield lifecycle (`PAUSED` $\to$ Extension Prompt $\to$ `CONFIRM / REJECT` $\to$ `RESUME / CANCEL`).
- Multi-session coordination across parallel browser tabs in Attached Mode.

### Phase 3: Workstation Agent IDE Dashboard - HOLD / NOT REQUIRED YET
- Standalone workstation web dashboard is put on hold.
- Evaluated only if the Chrome Extension SidePanel and Browser Use core prove insufficient for user workflows.
