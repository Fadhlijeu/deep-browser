# 13. Local Companion Runtime & WebSocket Protocol

## 📡 Companion Server Architecture

The local companion server is a high-speed Python FastAPI + WebSocket application running locally on `http://127.0.0.1:8765`.

---

## 🔌 WebSocket Channels & Message Schemas

### 1. `/ws/extension` (Chrome Extension Connection)
- Used for tab discovery, handoffs, SidePanel updates, and content script highlights.

### 2. `/ws/workstation` (Workstation IDE Connection)
- Streams real-time task events, milestones, action timelines, live screenshots, and resource telemetry.

```json
// Example Action Event broadcast:
{
  "event": "ACTION_EXECUTED",
  "task_id": "task_9a2f1c84",
  "timestamp": "2026-08-22T15:30:00Z",
  "step": 4,
  "action": {
    "tool": "type_text",
    "params": { "index": 2, "text": "Computer Science" },
    "thought": "Entering search keyword into the department query field"
  },
  "verification": {
    "status": "VERIFIED",
    "actual_value": "Computer Science",
    "verified_at": "2026-08-22T15:30:01Z"
  }
}
```
