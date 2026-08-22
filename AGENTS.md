# AGENTS.md: Deep-Browser Core Directives & Standards

This document establishes the architecture invariants, dependency boundaries, coding standards, and operational guidelines for all AI agents and engineers working on **Deep-Browser**.

---

## 1. Core Architecture Invariants

1. **Browser Use is the Main Core Foundation**:
   - Deep-Browser is a direct fork and rework of the upstream Browser Use repository (pinned at commit `85ddbfedf609166b2d2c76c3d80506649fee82a9`).
   - The primary core package is `browser_use/` directly in the repository root.
   - Do NOT create duplicate parallel implementations of `Agent`, `BrowserSession`, `BrowserProfile`, `DomService`, `Tools`, or CDP engines.
   - All improvements, bug fixes, and feature additions must be built by modifying, wrapping, or extending the `browser_use/` source tree directly.

2. **Local-First Always**:
   - Zero mandatory cloud dependencies (no mandatory Browserbase or Browser Use Cloud lock-in).
   - Operates against local Chromium/Chrome via direct CDP or Playwright bindings.
   - LLM routing supports external providers (Gemini, OpenAI, Anthropic) as well as 100% offline local endpoints (Ollama, vLLM).

3. **Strict Verification Layer (Never "Executed == Success")**:
   - Every browser action must be verified against actual DOM mutations or runtime evidence.
   - Deep-Browser adds a deterministic verification layer around Browser Use actions.
   - An action is never complete on API dispatch alone.

4. **Two Browser Modes (Attached vs. Managed)**:
   - **Attached Mode**: Connects directly to the user's running Chrome instance (`--remote-debugging-port=9222`), preserving user logins, cookies, and active tabs.
   - **Managed Mode**: Spawns isolated Chromium instances with dedicated `user_data_dir`.

5. **Multi-Browser Isolation**:
   - Concurrency is managed via Browser Use's `BrowserSession` and `BrowserProfile` abstractions.
   - State (cookies, local storage, tab context) must never leak across concurrent sessions.

6. **Safe Mode & Human Confirmation**:
   - Destructive or sensitive actions (form submissions, financial transactions, deletions, external messaging) evaluate user policy and yield for approval before execution.

---

## 2. Git & Release Workflow

- Commit format follows Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Remotes:
  - `origin`: `https://github.com/Fadhlijeu/deep-browser.git`
  - `upstream`: `https://github.com/browser-use/browser-use.git`
