# 12. Chrome Extension Architecture (Manifest V3)

## 🧩 Extension Components

```
extension/
├── manifest.json                  # Manifest V3 configuration
├── background/
│   └── service_worker.js         # WebSocket bridge to companion server (ws://127.0.0.1:8765)
├── sidepanel/
│   ├── index.html                # SidePanel agent co-pilot interface
│   ├── sidepanel.js              # State synchronization, quick tasks, handoff
│   └── sidepanel.css             # Glassmorphic dark styling
├── content/
│   ├── hud_overlay.js            # In-page bounding box & action highlight HUD
│   └── hud_overlay.css           # Glowing borders and action badges
└── icons/                        # Extension icons (16, 48, 128)
```

---

## ⚡ IPC & Tab Handoff Protocol

1. **Current Tab Handoff**:
   - User clicks **"Handoff Tab to Agent"** in the SidePanel.
   - The Extension queries the active Chrome tab (`chrome.tabs.query({ active: true, currentWindow: true })`).
   - Dispatches a message to `service_worker.js`:
     ```json
     {
       "type": "HANDOFF_TAB",
       "tab_id": 1429,
       "url": "https://pddikti.kemdiktisaintek.go.id",
       "title": "PDDIKTI Database"
     }
     ```
   - The Service Worker forwards the handoff to the local companion server over WebSocket.
   - The Deep-Browser companion server attaches to tab `1429` via CDP and initializes the agent session in Attached Mode.

2. **In-Page Visual HUD**:
   - When the agent targets element `[4]`, the companion server emits a `HIGHLIGHT_ELEMENT` event.
   - `hud_overlay.js` renders a non-intrusive glowing bounding box with an action pill: `Clicking Submit...`
