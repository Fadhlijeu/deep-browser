# Changelog

All notable changes to **Deep-Browser** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-22
### Added
- Comprehensive Architectural Documentation Suite (`docs/00_VISION.md` through `docs/24_...`).
- Core Python Engine with Observe-Think-Act-Verify supervisor loop.
- Browser Session Manager with Attached Mode (existing Chrome CDP) and Managed Mode (isolated profiles).
- DOM Service for interactive element extraction, bounding box calculation, and accessibility tree parsing.
- Deterministic Verification Layer for rigorous post-action assertion.
- Multi-provider LLM Router (Google Gemini, OpenAI, Anthropic, Ollama, OpenAI-compatible).
- Local Companion FastAPI + WebSocket Server (`ws://127.0.0.1:8765`).
- Chrome Extension MV3 with SidePanel dock, active tab handoff, and visual HUD overlay.
- Modern Glassmorphic Workstation Agent IDE Web Interface.
- Reusable workspace storage model (`workspace/tasks/`, `workspace/artifacts/`, `workspace/scripts/`).
