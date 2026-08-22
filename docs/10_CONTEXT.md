# 10. Context Engine & Domain Awareness

## 🧠 Site & Context Recognition

Deep-Browser dynamically adapts its reasoning strategy based on the detected application domain:

| Domain Type | Detected Signatures | Adapted Agent Strategy |
| :--- | :--- | :--- |
| **Search / Portal** (e.g. Google, PDDIKTI, DuckDuckGo) | Search inputs, result lists, pagination | Prioritizes link harvesting, tabular extraction, pagination scraping |
| **Form Wizard** (e.g. Google Forms, Typeform) | Inputs, radios, checkboxes, Stepper controls | Strict field verification, batch validation before submission |
| **Editor / Document** (e.g. Google Docs, Notion, Markdown) | ContentEditable, ProseMirror, Monaco | Cursor positioning, clipboard pasting, rich-text keystroke simulation |
| **Chat / Messaging** (e.g. WhatsApp Web, Slack, Discord) | Message history, send buttons, textareas | Enforces Safe Mode confirmation before message transmission |
| **SPA / Modern Web** (React, Vue, Angular) | Dynamic hydration, virtualized lists | Waits for DOM settling, mutation observers, stable bounding boxes |
