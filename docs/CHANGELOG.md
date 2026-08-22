# Deep-Browser Changelog

## [0.1.0] - 2026-08-22

### Architecture & Foundation
- **Desktop Software Base**: Forked and integrated the official Browser Use Desktop repository (`browser-use/desktop`) into `app/` as the primary Full Version workstation.
- **Companion Chrome Extension**: Retained the lightweight SidePanel interface (`extension/`) for in-browser session monitoring and active tab execution.
- **Core Library Foundation**: Pinned to upstream `browser-use/browser-use` core (`browser_use/`) for deterministic browser execution, DOM extraction, and tool dispatch.

### Product Enhancements
- **Interactive Safe Mode Gateway**: Added high-risk action confirmation policy (`deep_browser/policies/safety.py`) intercepting financial/destructive operations with confirmation modals.
- **Session Coordinator & Multi-Session Isolation**: Added `SessionCoordinator` (`deep_browser/sessions/coordinator.py`) with isolated user data dirs and runtime session state broadcasting.
- **Deterministic Verification Layer**: Added post-action DOM mutation validation.
- **Companion Bridge**: Implemented FastAPI + WebSocket bridge (`deep_browser/bridge/server.py`) exposing agent lifecycle endpoints and real-time state dispatch.
- **Cleaned Documentation**: Standardized repository documentation to single baseline report and concise architecture guides.
