# 25. Workspace Strategy: Browser Use as the Sole Primary Workspace

This document defines the definitive workspace strategy for **Deep-Browser**: **Browser Use itself is the main workspace, execution platform, and main codebase.** Deep-Browser does NOT build a second parallel workstation IDE or duplicate tools.

---

## 1. Core Principles

1. **Browser Use IS the Main Workspace**:
   - The primary core codebase is `browser_use/` directly in the repository root.
   - We do NOT create a separate custom dashboard, task explorer, timeline IDE, or duplicate workspace UI.

2. **The "Does Browser Use Already Provide This?" Invariant**:
   - Before adding or implementing ANY capability, evaluate:
     - **If Browser Use already provides it**: Use Browser Use's native implementation directly (e.g. navigation, clicks, inputs, scrolls, tabs, evaluate/JS execution, DOM extraction).
     - **If Browser Use provides it but Deep-Browser requires custom UX/telemetry**: Wrap or extend the Browser Use implementation directly in place.
     - **If Browser Use genuinely does not provide it**: Add it as a lean product-layer addition in `deep_browser/` or `extension/`.
     - **Never**: Create a third parallel engine or duplicate tool (e.g. do NOT create `browser_execute` because Browser Use already has native CDP `evaluate`/JS tools).

3. **Role of the Browser Use Ecosystem**:
   - `browser-use/browser-use`: **PRIMARY CORE CODEBASE**.
   - `browser-use/browsercode`: Reference only for coding agent ideas; do not duplicate tools.
   - `browser-use/desktop`: Reference only for multi-agent desktop patterns; do not duplicate UI.
   - `browser-use/web-ui`: Reference only.

---

## 2. Definitive Component Ownership

```
┌─────────────────────────────────────────────────────────────┐
│             DEEP-BROWSER PRODUCT EXTENSIONS                 │
│  - Chrome Extension MV3 (SidePanel + HUD Overlay)           │
│  - Safe Mode & Human Confirmation Gateways (PAUSE/CONFIRM)  │
│  - Event Stream Bridge (FastAPI + WebSocket :8765)          │
│  - Deterministic Verification & Evidence Capture Layer      │
│  - Multi-Session Coordinator & Workspace Disk Persistence   │
│  - Deep-Browser Branding & Local CLI                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Directly Imports & Executes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          BROWSER USE CORE (Root package: browser_use/)      │
│  - Agent Loop & Message Management                          │
│  - BrowserSession, BrowserProfile, & SessionManager         │
│  - DomService & Markdown Extraction                         │
│  - Tools Registry & Action Handlers (Click, Type, Eval)     │
│  - Multi-Provider LLM Abstractions (Gemini, OpenAI, Ollama) │
│  - Local Browser Lifecycle & Watchdogs                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Direct Local CDP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      LOCAL BROWSER                          │
│  - Attached Chrome (Port 9222) / Isolated Chromium Profiles │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Workstation Milestone Status

- **Milestone 3 (Custom Workstation Agent IDE Dashboard)**: **HOLD / NOT REQUIRED YET**.
- Deep-Browser does not need a complex standalone web dashboard when the **Chrome Extension SidePanel** provides zero-context-switch interaction directly within the user's browser.
