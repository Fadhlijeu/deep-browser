# 23. BrowserCode Research & Architectural Synthesis

## 🔍 Investigation Findings: BrowserCode

BrowserCode (forked from OpenCode with Browser Harness) reframes browser automation from simple click-coordinate generation into a **browser-native coding environment**:

1. **Browser-as-Execution-Context**:
   - Rather than sending isolated granular commands (`click_x_y`), BrowserCode allows the agent to run JavaScript snippets directly within the target tab context via CDP (`browser_execute(code)`).

2. **Persistent Session Context**:
   - Sessions are treated as living REPL environments, enabling multi-step state inspection without resetting DOM handles.

3. **Workspace Script Repository**:
   - Complex workflows (e.g. multi-step data extractors, form submitters) are saved as versioned JS/Python scripts in `workspace/scripts/` for zero-shot reuse.

---

## 🎯 Adoption into Deep-Browser

Deep-Browser adopts:
- `browser_execute` capability as a power tool alongside standard high-level tools (`type_text`, `click_element`).
- The `workspace/scripts/` persistent script directory.
- Low-latency CDP WebSocket connectivity.
