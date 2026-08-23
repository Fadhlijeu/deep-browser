/**
 * Deep Browser Content Script — In-Page HUD Overlay & Highlighting
 * ================================================================
 *
 * Renders non-destructive badges [1], [2] and target highlight boxes
 * on active Microsoft Edge tabs.
 */

(() => {
  let overlayContainer = null;
  let activeTargetBox = null;

  function ensureOverlay() {
    if (!overlayContainer || !document.body.contains(overlayContainer)) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = '__deep_browser_highlight_overlay__';
      document.body.appendChild(overlayContainer);
    }
    return overlayContainer;
  }

  function clearOverlay() {
    if (overlayContainer) {
      overlayContainer.innerHTML = '';
    }
    if (activeTargetBox && activeTargetBox.parentNode) {
      activeTargetBox.parentNode.removeChild(activeTargetBox);
      activeTargetBox = null;
    }
  }

  function highlightElementByIndex(index) {
    const el = document.querySelector(`[data-deep-browser-idx="${index}"]`);
    if (!el) return;

    if (activeTargetBox && activeTargetBox.parentNode) {
      activeTargetBox.parentNode.removeChild(activeTargetBox);
    }

    const rect = el.getBoundingClientRect();
    activeTargetBox = document.createElement('div');
    activeTargetBox.className = 'deep-browser-target-box';
    activeTargetBox.style.left = `${window.scrollX + rect.left - 2}px`;
    activeTargetBox.style.top = `${window.scrollY + rect.top - 2}px`;
    activeTargetBox.style.width = `${rect.width + 4}px`;
    activeTargetBox.style.height = `${rect.height + 4}px`;
    document.body.appendChild(activeTargetBox);

    setTimeout(() => {
      if (activeTargetBox && activeTargetBox.parentNode) {
        activeTargetBox.parentNode.removeChild(activeTargetBox);
        activeTargetBox = null;
      }
    }, 3000);
  }

  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'HIGHLIGHT_TARGET') {
      highlightElementByIndex(msg.index);
    } else if (msg.type === 'CLEAR_HIGHLIGHTS') {
      clearOverlay();
    }
  });
})();
