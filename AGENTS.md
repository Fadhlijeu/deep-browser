# AGENTS.md: Deep-Browser Core Directives & Standards

This document establishes the architecture invariants, dependency boundaries, coding standards, and operational guidelines for all AI agents and engineers working on **Deep-Browser**.

---

## 1. Core Architecture Invariants

1. **Local-First Always**:
   - Zero mandatory cloud dependencies (no mandatory Browserbase, no mandatory Browser Use Cloud, no hosted SaaS relay).
   - The browser runtime interacts with local Chromium/Chrome via direct CDP or Playwright bindings.
   - LLM routing supports external providers (Gemini, OpenAI, Anthropic) as well as 100% offline local endpoints (Ollama, vLLM, LMStudio).

2. **Strict Verification Layer (Never "Executed == Success")**:
   - Every browser action must be verified against actual DOM mutations or runtime evidence.
   - `type(text)` requires reading the target element's actual `.value` or `innerText`.
   - `click(selector)` requires checking for navigation, URL changes, DOM mutations, or expected UI states.
   - `submit(form)` requires checking for confirmation banners, response status, or state progression.
   - If verification fails, the agent must diagnose the discrepancy and trigger evidence-based recovery rather than blind repeated clicks.

3. **Two Browser Modes (Attached vs. Managed)**:
   - **Attached Mode**: Connects directly to the user's running Chrome instance (e.g. via `--remote-debugging-port=9222` or CDP URL), preserving user logins, cookies, and active tabs without manual cookie scraping.
   - **Managed Mode**: Spawns isolated Chromium instances with dedicated `user_data_dir`, isolated sessions, and explicit lifecycle management.

4. **Multi-Browser Isolation**:
   - Each browser session maintains an explicit `session_id`, `profile_id`, `browser_id`, `tab_id`, and `agent_id`.
   - State (cookies, local storage, tab context, DOM history) must never leak across concurrent sessions implicitly.

5. **Safe Mode & Human Confirmation**:
   - Destructive or sensitive actions (Form submissions, Financial transactions, Account changes, Deletions, External messaging) must evaluate user policy.
   - In `SAFE` mode, the agent yields to the user with a confirmation request before execution.

6. **Clean Slate Provenance**:
   - Do NOT import, reference, or incorporate legacy DeepDOM source files.
   - Preserve upstream provenance and MIT notices in [`THIRD_PARTY_NOTICES.md`](file:///d:/PROJECT/deep-browser/THIRD_PARTY_NOTICES.md).

---

## 2. Coding & Implementation Standards

### Python Engine (`src/deep_browser/`)
- Target: Python 3.11+ (fully compatible with Python 3.14).
- Type Hints: Strict typing everywhere (`pydantic.BaseModel`, `typing.Optional`, `typing.List`, `typing.Dict`).
- Async/Await: All CDP, WebSocket, and LLM communication must be fully asynchronous with proper timeouts and error propagation.
- Logging: Structured logging with Rich console formatting and file output in `workspace/logs/`.

### Client & Workstation Web UI (`src/deep_browser/web/`)
- Pure, modern vanilla CSS + ES modules / lightweight reactive components.
- Zero AI-slop: Curated dark-mode theme, glassmorphic HUD overlays, responsive layout, accessible keybindings, high-density telemetry widgets.

### Chrome Extension MV3 (`extension/`)
- Manifest V3 compliant.
- Background service worker communicates via WebSocket to local companion runtime (`ws://127.0.0.1:8765`).
- SidePanel API provides a persistent agent co-pilot dock alongside active browsing.

---

## 3. Task & Verification State Machine

```
PLANNING ──→ RUNNING ──→ OBSERVING ──→ THINKING ──→ ACTING ──→ VERIFYING
               │                                                    │
               ▼                                                    ▼
             PAUSED                                         [Pass: NEXT / Fail: RECOVERY]
               │                                                    │
               ▼                                                    ▼
           CANCELLED                                            COMPLETED / FAILED
```

---

## 4. Git & Commit Guidelines

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Every significant implementation change must be tested, checked, and recorded in [`docs/22_PROGRESS.md`](file:///d:/PROJECT/deep-browser/docs/22_PROGRESS.md).
