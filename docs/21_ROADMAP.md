# 21. Phased Product Roadmap

## 🗺️ Release Phases

### Phase 1: Foundation & Core Engine (v0.1.0) - Current
- Clean-slate architectural documentation suite (25 docs).
- Core Python agent loop with Observe-Think-Act-Verify supervisor.
- Browser CDP runtime (Attached Mode + Managed Mode).
- Deterministic verification engine for inputs, navigation, and clicks.
- Multi-provider LLM router (Gemini, OpenAI, Anthropic, Ollama).
- Local Companion FastAPI + WebSocket server (`ws://127.0.0.1:8765`).
- Chrome Extension MV3 with SidePanel dock & HUD overlay.
- Glassmorphic Workstation Agent IDE Web Interface.

### Phase 2: Multi-Browser Concurrency & Replay (v0.2.0)
- Parallel agent scheduler with CPU/RAM throttles.
- Action replay & step-back debugger.
- Deep research mode with multi-tab harvesting.

### Phase 3: Advanced Perception & Native Companion (v0.3.0)
- Local vision models (WebGPU / Ollama vision) for complex canvas interactions.
- Native OS desktop tray wrapper.
