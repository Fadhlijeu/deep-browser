# Deep-Browser Architecture Specification

## 1. System Architecture

Deep-Browser establishes a unified dual-surface architecture sharing a single authoritative agent core:

### Full Version (Desktop Software)
- **Path**: `app/`
- **Technology**: Electron 41, Vite 6, React 19, TypeScript, Zustand, Better-SQLite3, Node-PTY.
- **Role**: Full-screen multi-agent command hub, embedded browser slots with isolated profiles, database-backed session timelines, and native background process orchestration.
- **Key Modules**:
  - `src/main/sessions/BrowserPool.ts`: Manages embedded `WebContentsView` slots and CDP target attachments.
  - `src/main/sessions/SessionDb.ts`: SQLite database tracking session events, prompts, status, and tokens.
  - `src/main/localTaskServer.ts`: Authenticated HTTP local server on `127.0.0.1` for external task submissions.
  - `src/main/hl/engines/`: Multi-engine execution adapters (`browsercode`, `claude-code`, `codex`).

### Light Version (Chrome Extension Companion)
- **Path**: `extension/`
- **Technology**: Chrome Extension Manifest V3, SidePanel API, WebSocket Client.
- **Role**: In-browser companion attached directly to the user's active Chrome tab without spawning full desktop windows.
- **Key Modules**:
  - `extension/sidepanel/`: SidePanel UI showing active session, DOM inspector, agent lifecycle controls (Run, Pause, Resume, Stop), and Safe Mode confirmation modals.
  - `extension/background/`: Service worker handling connection to the local bridge.

---

## 2. Shared Core Runtime & Deep-Browser Enhancements
- **Core Library (`browser_use/`)**: The main engine governing `Agent`, `BrowserSession`, `BrowserProfile`, `Tools`, `DomService`, and CDP communication.
- **Deterministic Verification Layer (`deep_browser/verification/`)**: Validates DOM mutations and navigation state after tool execution.
- **Safe Mode Interactive Confirmation (`deep_browser/policies/safety.py`)**: Intercepts high-risk actions (financial transactions, form submissions, deletions) and pauses execution until confirmed by the user via Desktop or Extension UI.
- **Event Broadcaster (`deep_browser/events/`)**: Real-time event streaming across WebSocket clients.

---

## 3. Storage & Profile Boundaries
- Desktop application runtime data resides under Electron's `userData` (`SessionDb` SQLite + isolated Chromium profiles).
- Browser profiles are strictly isolated per session to prevent session state and cookie collisions.
- Cookie porting imports authenticated state from default Chrome profiles on demand.
