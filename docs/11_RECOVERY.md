# 11. Evidence-Based Recovery & Self-Healing

## 🩹 Anti-Loop Recovery Mechanisms

Rather than repeating failed actions blindly, Deep-Browser diagnoses failures using DOM mutation deltas and structured feedback.

```mermaid
graph TD
    Fail[Action Verification Failed] --> Diagnose[Diagnose Discrepancy]
    Diagnose --> TreeCheck{Element Changed?}
    
    TreeCheck -->|Element Stale / Moved| ReIndex[Re-index DOM & Re-locate Element]
    TreeCheck -->|Input Value Mismatched| ClearType[Focus, Clear Value & Retype via Keystrokes]
    TreeCheck -->|Overlay / Modal Blocking| DismissOverlay[Detect & Dismiss Overlay / Accept Cookies]
    TreeCheck -->|Navigation Timeout| FallbackNav[Check Network Idle & Retry Navigation]
    
    ReIndex --> Retry[Execute Remedial Action]
    ClearType --> Retry
    DismissOverlay --> Retry
    FallbackNav --> Retry
    
    Retry --> ReVerify{Verify Remedial Action}
    ReVerify -->|Success| Resume[Resume Normal Agent Loop]
    ReVerify -->|Exhausted (3x)| PauseTask[Pause Task & Request User Guidance]
```

---

## 🛑 Loop Detection Rules

1. **Consecutive Action Match**: If the agent attempts the exact same action tuple `(tool, args)` 3 times in a row without state progress, the loop detector interrupts execution.
2. **URL Stall**: If navigation actions do not change `location.href` within 2 attempts, the agent switches to direct JavaScript navigation or requests manual assistance.
