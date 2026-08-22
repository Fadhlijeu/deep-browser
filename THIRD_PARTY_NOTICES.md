# Third-Party Notices & Upstream Provenance

Deep-Browser incorporates ideas, architectures, patterns, and derive components from the following open-source projects. All licenses, copyrights, and intellectual property rights belong to their respective authors.

---

### 1. Browser Use Core
- **Project**: [Browser Use](https://github.com/browser-use/browser-use)
- **License**: MIT License
- **Copyright**: (c) 2024-2026 Browser Use Contributors
- **Components Referenced/Derived**:
  - Agent action loop concepts & supervisory patterns
  - CDP browser connection primitives & session lifecycle
  - Action model & Controller dispatch architecture
  - DOM tree extraction & coordinate mapping
- **Attribution Statement**: Deep-Browser is derived from and influenced by Browser Use's open-source architecture, re-architected for local-first execution, strict deterministic verification, and Chrome Extension integration.

---

### 2. BrowserCode
- **Project**: [BrowserCode](https://github.com/browser-use/browsercode) (fork of OpenCode with Browser Harness)
- **License**: MIT License
- **Copyright**: (c) 2025-2026 Browser Use Contributors / OpenCode Authors
- **Components Referenced/Derived**:
  - In-process browser execution concepts (`browser_execute`)
  - Workspace script storage and execution state persistence
  - Persistent browser session paradigms

---

### 3. Browser Use Desktop
- **Project**: [Browser Use Desktop](https://github.com/browser-use/desktop)
- **License**: MIT License
- **Copyright**: (c) 2025-2026 Browser Use Contributors
- **Components Referenced/Derived**:
  - Desktop-grade multi-browser session organization
  - Agent team workflow principles

---

### 4. Playwright & Chrome DevTools Protocol (CDP)
- **Projects**: Microsoft Playwright (Apache 2.0), Chrome DevTools Protocol (BSD-3-Clause)
- **Components**: Browser automation protocols, DevTools interaction APIs.

---

All third-party trademarks, service marks, and company names are the property of their respective owners.
