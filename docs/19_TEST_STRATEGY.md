# 19. Multi-Tier Test Strategy

## 🧪 Testing Hierarchy

```
                      ┌────────────────────────┐
                      │      E2E Golden        │
                      │  (10 Live Real Tasks)  │
                      ├────────────────────────┤
                      │  Extension & IPC Mock  │
                      │ (SidePanel + Server WS)│
                      ├────────────────────────┤
                      │    Integration Tests   │
                      │  (Agent + CDP + DOM)   │
                      ├────────────────────────┤
                      │       Unit Tests       │
                      │  (Models, Rules, LLM)  │
                      └────────────────────────┘
```

---

## 🏆 The 10 Golden E2E Test Scenarios

1. **Google Search & Harvest**: Query search term, harvest top 5 organic links and titles.
2. **Form Autofill & Verification**: Fill 5-field form, verify field states, verify submit confirmation.
3. **Multi-Step SPA Navigation**: Navigate React/Vue app with pagination and client-side routing.
4. **Attached Mode Session Continuity**: Attach to authenticated session, read profile username.
5. **Multi-Browser Concurrency**: Run 2 agents in parallel on 2 distinct domains without cookie leakage.
6. **Task Cancellation & State Flush**: Cancel long-running task mid-step and verify browser cleanly unblocks.
7. **Evidence-Based Loop Recovery**: Introduce synthetic input mismatch and verify agent self-corrects.
8. **Human Confirmation Intercept**: Trigger mock destructive action, verify execution pauses for approval.
9. **Long-Running Paginated Scraping**: Execute 15-page sequential extraction with token/memory bounds.
10. **CDP Reconnection Resiliency**: Disconnect and reconnect WebSocket CDP without losing task state.
