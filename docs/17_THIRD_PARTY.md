# 17. Third-Party Dependencies & License Audit

## 📜 Dependency License Matrix

All direct dependencies integrated into Deep-Browser have been audited for license compatibility:

| Component / Package | Upstream License | Usage in Deep-Browser |
| :--- | :--- | :--- |
| **Browser Use Core Concepts** | MIT License | Architecture reference, action dispatch loop |
| **BrowserCode Patterns** | MIT License | In-process CDP script execution, workspace model |
| **Browser Use Desktop** | MIT License | Multi-agent coordination patterns |
| **Playwright** | Apache 2.0 | Browser automation and page interaction |
| **FastAPI & Uvicorn** | MIT / BSD | Local companion HTTP and WebSocket server |
| **Pydantic** | MIT License | Strict schema validation and data models |
| **Rich** | MIT License | Terminal formatting and structured logging |

---

## 🚫 License Constraints & Exclusions

- **Copyleft Avoidance**: Deep-Browser does not incorporate GPL/AGPL licensed runtime libraries into its distribution to maintain full MIT freedom for end users and commercial deployments.
