# 21. Phased Product Roadmap

## 🗺️ Release Phases

### Phase 1: Core Fork, Extension & Deterministic Verification (v0.1.0) - ✅ COMPLETED
- Fork and integration of upstream `browser-use` core (`85ddbfedf609166b2d2c76c3d80506649fee82a9`).
- Deep-Browser product layer (`deep_browser/`):
  - Local companion FastAPI + WebSocket server (`ws://127.0.0.1:8765/ws` & `/ws/extension`).
  - Structured timeline event stream broadcaster (`deep_browser.events`).
  - Deterministic verification engine wrapping actions (`deep_browser.verification`).
  - Workspace storage manager for tasks, artifacts, and traces (`deep_browser.workspace`).
- Chrome Extension MV3 with SidePanel dock and real-time streaming HUD.
- Live in-process browser execution tests verified.

### Phase 2: Interactive Safe Mode Confirmation Gateways (v0.2.0) - ✅ COMPLETED (Milestone 4)
- **Deep-Browser Safe Mode Policy**: Intercepts sensitive actions (`SUBMIT`, `SEND`, `DELETE`, `PURCHASE`, `PUBLISH`, `ACCOUNT_CHANGE` in English and Indonesian).
- **Zero-Engine Duplication**: Uses `SafeTools` wrapping `browser_use.Tools` directly. Browser Use executes actions via `super().act()`.
- **Interactive Extension Modal**: Displays sensitive action details, target element text, and `[ Confirm ]` / `[ Reject ]` buttons.
- **Strict Pause & Resume Lifecycle**:
  - `RUNNING` $\to$ `PAUSED_FOR_CONFIRMATION` $\to$ user confirms $\to$ `RESUMING` $\to$ `COMPLETED`.
  - User rejects or timeout $\to$ cancels pending action with deterministic error $\to$ never executes.
- **Full Verification Suite**: 75/75 automated unit and live Chromium integration tests passing.

### Phase 3: Workspace Ecosystem Evaluation & Decision Gate - ✅ COMPLETED (Milestone 3)
- Evaluated `browser-use/browser-use`, `browser-use/browsercode`, `browser-use/desktop`, and `browser-use/web-ui`.
- Established and locked `docs/WORKSPACE_DECISION.md`.
- **Decision**: No fifth standalone dashboard or redundant Electron container. The **Chrome Extension SidePanel + HUD** is the primary UI, and **`browser_use/`** in repository root is the sole primary agent/browser core.

### Phase 4: Multi-Browser Profile & Attached Session Coordination (v0.3.0) - 🎯 NEXT TARGET (Milestone 5)
- **Attached Mode vs. Managed Mode**: Connect directly to user Chrome on `--remote-debugging-port=9222` or spawn isolated Chromium profiles.
- **Multi-Session Isolation**: Coordinate parallel `browser_use.BrowserSession` instances without cross-session cookie/tab leakage.
- **SidePanel Session Switcher**: Real-time switching between active agent sessions in the Extension UI.
