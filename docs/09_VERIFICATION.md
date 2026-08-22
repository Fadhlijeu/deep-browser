# 09. Deterministic Verification Layer

## 🎯 Verification Mandate

In Deep-Browser, **an action is never marked successful until verified by post-execution DOM assertions**.

```
Execution Pipeline:
PLANNED ──→ ATTEMPTED ──→ EXECUTED ──→ OBSERVED ──→ VERIFIED ──→ COMMITTED
```

---

## 🔍 Verification Rules by Action Type

### 1. `type_text`
- **Assertion**: Evaluates `document.querySelector(selector).value` or `innerText`.
- **Match Condition**: Actual text must contain or strictly match the typed string.
- **Self-Healing on Failure**: If text is missing or partial, triggers element focus, clear, and key-by-key synthetic typing.

### 2. `click_element`
- **Assertion**: Evaluates the post-click state based on action intent:
  - Navigation: Checks if `window.location.href` updated or `history.length` changed.
  - Dialog / Modal: Checks for appearance of modal container or aria-modal.
  - Toggle / Checkbox: Checks `element.checked === target_state` or `aria-expanded === target_state`.

### 3. `select_option`
- **Assertion**: Evaluates `select.options[select.selectedIndex].value` or `.text`.
- **Match Condition**: Selected option value/label matches targeted selection.

### 4. `navigate`
- **Assertion**: Waits for `Page.loadEventFired` / `networkidle` and asserts `window.location.href` matches target origin/path.

### 5. `submit_form`
- **Assertion**: Checks for URL redirection, disappearing form element, success toast/banner, or absence of validation error classes (`.is-invalid`, `.error`).
