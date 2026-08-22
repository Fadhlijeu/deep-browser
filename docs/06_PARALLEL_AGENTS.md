# 06. Parallel Agents & Multi-Session Concurrency

## 👥 Concurrent Agent Architecture

Deep-Browser supports running multiple autonomous agents simultaneously across isolated browser instances.

```mermaid
graph TD
    subgraph ConcurrencyManager ["Concurrency & Resource Manager"]
        Orchestrator["Task Scheduler (Max Concurrency: 4)"]
        ResourceMonitor["Memory & CPU Guardrail"]
    end

    subgraph AgentInstances ["Active Parallel Agents"]
        AgentA["Agent 1 (Research)<br/>Profile: Research"]
        AgentB["Agent 2 (PDDIKTI)<br/>Profile: Personal"]
        AgentC["Agent 3 (Forms)<br/>Profile: Work"]
    end

    subgraph BrowserPool ["Isolated Chromium Instances"]
        Browser1["Chromium 1 (PID 1042)<br/>Port: 9223"]
        Browser2["Attached Chrome<br/>Port: 9222"]
        Browser3["Chromium 2 (PID 1088)<br/>Port: 9224"]
    end

    Orchestrator --> AgentA
    Orchestrator --> AgentB
    Orchestrator --> AgentC

    AgentA --> Browser1
    AgentB --> Browser2
    AgentC --> Browser3

    ResourceMonitor -.-> Orchestrator
```

---

## 🛡️ Isolation Guarantees

1. **State Isolation**:
   - Zero shared memory or cross-talk between agents.
   - Each agent maintains its own token counter, conversation history, DOM cache, and tool registry.

2. **Resource Guardrails**:
   - Configurable `max_concurrent_browsers` (default: `3`).
   - Automatic throttling when system memory usage exceeds 85%.

3. **Independent Lifecycle & Cancellation**:
   - Cancelling or pausing Agent A has zero impact on the execution of Agent B or Agent C.
