# 15. Security Model & Safe Mode Policies

## 🛡️ Trust Boundaries & Execution Isolation

Deep-Browser operates with a strict principle of least privilege, preventing unauthorized destructive operations across both personal and managed browser sessions.

---

## 🔒 Safe Mode Policy Engine

Safe Mode enforces interactive user confirmation for sensitive actions:

| Action Category | Examples | Default Policy |
| :--- | :--- | :--- |
| **Read / Navigation** | `navigate`, `scroll`, `extract_text`, `screenshot` | **Auto-Allowed** |
| **Safe Input** | `type_text` in search boxes, filter selects | **Auto-Allowed** |
| **Form Submission** | `click(submit)`, `submit_form` | **Requires Confirmation** in Safe Mode |
| **External Messaging** | Sending messages on WhatsApp, Discord, Slack | **Requires Confirmation** always |
| **Financial / Cart** | Clicking "Place Order", "Pay Now", entering CC | **Blocked / Strict Confirmation** |
| **Destructive Data** | Deleting repositories, deleting records | **Requires Confirmation** always |

Users can toggle Safe Mode globally or configure granular rules per domain in the settings panel.
