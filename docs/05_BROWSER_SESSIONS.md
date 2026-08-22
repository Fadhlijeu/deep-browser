# 05. Browser Sessions: Attached Mode vs Managed Mode

Deep-Browser provides first-class support for two distinct browser operational paradigms to address both personal authenticated workflows and clean-slate automated tasks.

---

## 🔀 Comparison of Browser Modes

| Capability | Attached Mode | Managed Mode |
| :--- | :--- | :--- |
| **Target Browser** | User's running Google Chrome | Spawned Chromium / Chrome instance |
| **Authentication / Logins** | Inherited automatically (active user session) | Fresh session per profile directory |
| **Session Isolation** | Shared with user's active browser | 100% isolated per `user_data_dir` |
| **Launch Mechanism** | Connects to `--remote-debugging-port` or CDP URL | Spawned by Deep-Browser process manager |
| **Primary Use Cases** | Interacting with personal accounts (PDDIKTI, GitHub, email, private dashboards) | Parallel research, automated form filling, QA tests, web scraping |
| **Cleanup Lifecycle** | Remains open when task finishes | Cleaned up or retained per profile settings |

---

## 🔌 Attached Mode Configuration

To launch Chrome for Attached Mode:

```bash
# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebugProfile"

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"
```

Deep-Browser discovers active tabs via `http://127.0.0.1:9222/json/version` and attaches to the target tab via CDP WebSocket without disrupting the user's workflow.

---

## 📦 Managed Mode Configuration

Managed mode allocates a dedicated profile directory under `workspace/sessions/{profile_id}/`:
- Stores cookies, IndexedDB, local storage, and cache independently.
- Multiple managed profiles can run concurrently with distinct proxy and viewport configurations.
