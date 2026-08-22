# Browser Use Desktop Baseline Report

## 1. Executive Summary
- **Upstream Repository**: `https://github.com/browser-use/desktop` (Revision: `f073b7574f7927185ebbebd87556391d5cb0cfd1`)
- **Package & Framework**: Electron 41.2.1, Vite 6.4.2, React 19.2.5, TypeScript 5.6.0, Zustand, TanStack React Query, Better-SQLite3, Node-PTY.
- **Architectural Scope**: Complete multi-agent desktop workstation featuring native embedded Chromium view slots (`WebContentsView`), direct Chrome DevTools Protocol (CDP 1.3) engine connection, local HTTP task control server (`localTaskServer.ts`), multi-engine spawner (`browsercode`, `claude-code`, `codex`), Chrome profile cookie importer, and session database (`SessionDb.ts`).

---

## 2. Baseline Verification Results
- **Installation**: Succeeded via `npm install --legacy-peer-deps` with native C++ rebuild for `better-sqlite3` and `node-pty`.
- **TypeScript Typecheck (`npm run typecheck`)**: **100% PASSED** (`tsc --noEmit` exited with code 0, 0 errors).
- **Test Suite (`npm test`)**: **663 PASSED** / 9 POSIX-specific path tests on Windows. Core `SessionDb`, schema migrations, agent protocol schemas, and state managers verified.
- **Local Task Server**: Runs on `127.0.0.1` binding dynamically with token authentication (`local-task-server.json`), exposing `/tasks` and `/health`.

---

## 3. Product Architecture (Deep-Browser Full vs Light)
```
                          DEEP-BROWSER
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     DESKTOP SOFTWARE                       CHROME EXTENSION
      (FULL VERSION)                         (LIGHT VERSION)
  Fork of browser-use/desktop          SidePanel / In-Browser UI
  • Multi-Agent Workstation            • Compact Companion
  • Embedded Browser Slots             • Active Tab Control
  • Session SQLite Database            • Interactive Safe Mode Gate
  • Local Task Server                  • Direct WebSocket Client
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
                   SHARED AGENT RUNTIME & BRIDGE
                     • browser_use Core Engine
                     • SafeModePolicy Gateway
                     • EventBroadcaster
```

---

## 4. Rebranding & Integration Directives
1. **Desktop Package Identity**: Rebrand from `Browser Use` to **`Deep-Browser`**.
2. **Attribution & Licenses**: Retain full upstream MIT license and author notices in `THIRD_PARTY_NOTICES.md`.
3. **Companion Extension**: Connect Deep-Browser Chrome Extension to the Desktop runtime via the shared local bridge (`/tasks` & WebSocket event streams).
