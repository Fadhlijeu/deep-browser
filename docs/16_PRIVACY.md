# 16. Privacy, Data Retention & Secret Redaction

## 👁️ Data Privacy Guarantees

1. **Local Data Confinement**:
   - All browser profiles, cookies, browsing history, and DOM snapshots are saved exclusively in the local `workspace/` folder.
   - Zero telemetry, session recordings, or DOM states are transmitted to external servers.

2. **Automated Secret Redaction**:
   - The DOM Service automatically scrubs sensitive fields before passing DOM context to LLMs:
     - `input[type="password"]` $\to$ values masked as `[REDACTED_PASSWORD]`.
     - Credit card patterns, security codes (CVV), and API key signatures $\to$ masked as `[REDACTED_SECRET]`.

3. **Workspace Sanitization**:
   - Users can purge task history, cached snapshots, or session storage with a single command:
     ```bash
     deep-browser workspace clean --all
     ```
