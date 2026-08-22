# Third-Party Notices & Upstream Provenance

Deep-Browser is directly forked and reworked from the open-source **Browser Use** project, integrating concepts and patterns from **BrowserCode** and **Browser Use Desktop**.

---

### 1. Browser Use Core (Primary Base)
- **Project**: [Browser Use](https://github.com/browser-use/browser-use)
- **Upstream Repository**: `https://github.com/browser-use/browser-use.git`
- **Pinned Commit SHA**: `85ddbfedf609166b2d2c76c3d80506649fee82a9`
- **License**: MIT License
- **Copyright**: (c) 2024-2026 Browser Use Contributors
- **Components In Tree**:
  - `browser_use/agent/` (Agent loop, prompts, MessageManager, views)
  - `browser_use/browser/` (BrowserSession, BrowserProfile, SessionManager, Events, Watchdogs)
  - `browser_use/dom/` (DomService, MarkdownExtractor, Serializer)
  - `browser_use/tools/` (Tools service, action registry)
  - `browser_use/llm/` (BaseChatModel, Provider integrations)
  - `browser_use/controller/`

---

### 2. BrowserCode
- **Project**: [BrowserCode](https://github.com/browser-use/browsercode) (MIT License)
- **Copyright**: (c) 2025-2026 Browser Use Contributors / OpenCode Authors
- **Referenced Patterns**: In-process CDP scripting, persistent browser session paradigms.

---

### 3. Browser Use Desktop (Primary Desktop Base)
- **Project**: [Browser Use Desktop](https://github.com/browser-use/desktop)
- **Upstream Repository**: `https://github.com/browser-use/desktop.git`
- **Pinned Base Commit SHA**: `f073b7574f7927185ebbebd87556391d5cb0cfd1`
- **License**: MIT License
- **Copyright**: (c) 2025-2026 Reagan Hsu / Browser Use Contributors
- **Components In Tree**:
  - `app/` (Electron desktop client, Vite build configs, React 19 UI, WebContentsView pool, local task server)
  - `shared/` (JSON schemas for tasks, agent events, onboarding, and tabs)


---

All third-party trademarks, service marks, and company names are the property of their respective owners.
