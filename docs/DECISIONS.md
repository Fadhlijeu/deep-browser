# Architecture Decision Records (ADRs)

## ADR-001: Local Companion Server & Extension Bridge
- **Status**: Accepted
- **Context**: Running the entire Python AI engine inside Chrome Extension WebAssembly is constrained by memory, cold starts, and missing native CDP sockets.
- **Decision**: Run the Python engine as a native local companion process (`FastAPI` + `uvicorn` on `ws://127.0.0.1:8765`), with the Chrome Extension acting as a lightweight presentation, sidepanel, and HUD bridge.

## ADR-002: Deterministic Action Verification
- **Status**: Accepted
- **Context**: LLM browser automation frequently hallucinates success after issuing a synthetic click or input command even if DOM state failed to update.
- **Decision**: Enforce a mandatory post-action verification pass reading the DOM and window state before marking any action as `VERIFIED` and committing milestone progress.

## ADR-003: Multi-Provider LLM Abstraction
- **Status**: Accepted
- **Context**: Users require flexibility between cloud frontier models (Gemini, OpenAI, Anthropic) and private offline local models (Ollama).
- **Decision**: Build a unified provider router with uniform JSON schema output formatting and automated failover.
