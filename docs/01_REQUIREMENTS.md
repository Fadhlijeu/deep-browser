# 01. System Requirements & Functional Scope

This document specifies the functional, non-functional, and technical requirements for **Deep-Browser**.

---

## 📋 Functional Requirements (FR)

### FR-1: Browser Session Management
- **FR-1.1**: Connect to an already running Google Chrome instance via remote debugging port (default `9222`) or WebSocket CDP URL.
- **FR-1.2**: Launch managed Chromium profiles with dedicated `user_data_dir` directories for parallel task isolation.
- **FR-1.3**: Support concurrent sessions with isolated cookies, cache, local storage, and page contexts.

### FR-2: Supervisory Agent Loop
- **FR-2.1**: Implement a structured cycle: `PLAN` $\to$ `OBSERVE` $\to$ `THINK` $\to$ `ACT` $\to$ `VERIFY` $\to$ `COMMIT`.
- **FR-2.2**: Maintain step-by-step history, reasoning traces, DOM snapshots, and token/latency metrics.
- **FR-2.3**: Yield execution to user for human-in-the-loop confirmation before sensitive actions (Safe Mode).

### FR-3: Deterministic Action Verification
- **FR-3.1**: Verify input values (`input.value === expected_text`).
- **FR-3.2**: Verify navigation consequences (`page.url` matches expected route).
- **FR-3.3**: Verify selection states (`select.value`, `checkbox.checked`).
- **FR-3.4**: Generate actionable diagnostic diffs on verification failure for targeted self-healing.

### FR-4: Chrome Extension Integration
- **FR-4.1**: Chrome Extension Manifest V3 with persistent SidePanel co-pilot UI.
- **FR-4.2**: Quick command bar with active tab handoff (`Handoff Current Tab to Agent`).
- **FR-4.3**: Real-time visual HUD highlight overlay on the target web page.

### FR-5: Workstation Agent IDE
- **FR-5.1**: Live Action Timeline with status badges (Executing, Verified, Failed, Recovered).
- **FR-5.2**: Multi-Browser Session Explorer with live thumbnail/preview streaming.
- **FR-5.3**: Local Artifact & Task Explorer (browsing generated reports, scraped data, and scripts).

### FR-6: LLM Provider Flexibility
- **FR-6.1**: Support Google Gemini (`gemini-2.5-pro`, `gemini-2.5-flash`), OpenAI (`gpt-4o`, `gpt-4o-mini`), Anthropic (`claude-3-7-sonnet`), and local Ollama / OpenAI-compatible servers.

---

## ⚡ Non-Functional Requirements (NFR)

- **NFR-1 (Local First)**: 0 cloud proxy dependencies.
- **NFR-2 (Latency)**: IPC communication between Extension, Server, and Browser under 20ms.
- **NFR-3 (Resource Guardrails)**: Configurable max concurrent browser instances and memory caps.
- **NFR-4 (Safety & Privacy)**: Passwords and sensitive form fields are masked in logs and timelines.
