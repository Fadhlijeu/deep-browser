# 07. Local Workspace & Artifact Storage

Deep-Browser adopts the concept of an **Agent Workspace** (drawing from BrowserCode and IDE workflows) to persist state, generated assets, and evidence locally.

---

## 📂 Workspace Layout

```
workspace/
├── tasks/                 # Serialized task definitions and run metadata (.json)
├── sessions/              # Browser profiles and session cookie stores
├── scripts/               # Reusable CDP / JS automation scripts
├── artifacts/             # Generated user deliverables (markdown, CSV, JSON reports)
├── screenshots/           # Verification snapshots and visual audit trail (.webp, .png)
├── downloads/             # Downloaded files from browser sessions
├── logs/                  # Raw execution traces, CDP traffic, and model reasoning logs
├── memories/              # Long-term domain heuristics and site knowledge
└── agent-state/           # Checkpoints for pause/resume and replay capabilities
```

---

## 📄 File Formats & Standards

- **Task Definitions (`tasks/{task_id}.json`)**: Contains goal, milestones, action timeline, verification receipts, and cost/token metrics.
- **Artifacts (`artifacts/{task_id}_{artifact_name}.ext`)**: Rendered directly in the Workstation IDE UI with markdown previews, tables, and charts.
- **Screenshots (`screenshots/{task_id}_{step_idx}_{action_name}.webp`)**: Compressed WebP format for fast streaming and low disk footprint.
