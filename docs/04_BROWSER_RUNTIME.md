# 04. Browser Runtime & CDP Protocol Layer

## 🌐 Chrome DevTools Protocol (CDP) Direct Architecture

Deep-Browser utilizes direct Chrome DevTools Protocol (CDP) connections over WebSockets to communicate with Chromium-based browsers, guaranteeing low latency and fine-grained DOM/network access.

---

## ⚡ CDP Communication Architecture

```
Deep-Browser CDP Engine
         │
         ├── Page Domain        (Page.navigate, Page.captureScreenshot, Page.reload)
         ├── DOM Domain         (DOM.getDocument, DOM.querySelector, DOM.describeNode)
         ├── Runtime Domain     (Runtime.evaluate, Runtime.callFunctionOn)
         ├── Input Domain       (Input.dispatchMouseEvent, Input.dispatchKeyEvent)
         ├── Network Domain     (Network.enable, Network.setExtraHTTPHeaders)
         └── Target Domain      (Target.getTargets, Target.attachToTarget)
```

---

## 🛠️ Key Runtime Capabilities

1. **Direct In-Process JavaScript Execution**:
   - Enables executing atomic DOM query scripts directly on the page, extracting accurate bounding boxes, computed styles, and accessibility attributes in a single round-trip.

2. **Synthetic Input Events with Human Timing**:
   - Dispatches realistic mouse moves, clicks, and keyboard strokes via `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`, preventing synthetic event rejection on dynamic pages.

3. **Page Mutation & Lifecycle Events**:
   - Subscribes to `Page.loadEventFired`, `Page.domContentEventFired`, and `Page.frameNavigated` to guarantee accurate post-action state synchronization.

4. **Multi-Tab Target Management**:
   - Uses `Target.getTargets` and `Target.attachToTarget` with `flatten: true` to manage popups, multi-tab workflows, and iframes seamlessly.
