# 20. Performance Metrics & Benchmarks

Deep-Browser continuously tracks operational metrics to avoid performance regressions.

---

## 📊 Core Performance Telemetry

```
Metric Keys:
- task_success_rate (%)
- action_verification_accuracy (%)
- action_dispatch_latency_ms (Target: < 50ms)
- dom_extraction_latency_ms (Target: < 120ms)
- llm_time_to_first_token_ms
- token_consumption_per_step
- peak_ram_mb_per_browser (Target: < 450MB)
- retry_ratio (%)
```

Benchmarking scripts live in `tests/benchmarks/` and output structured telemetry JSON to `workspace/logs/benchmarks.json`.
