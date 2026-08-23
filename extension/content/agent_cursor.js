/**
 * Deep Browser Content Script — Agent Cursor Controller
 * =====================================================
 *
 * Renders a visible animated cursor that moves with human-like easing
 * to elements and coordinates targeted by Deep Browser Agent actions.
 */

(() => {
  let cursorEl = null;
  let idleTimer = null;

  function ensureCursor() {
    if (!cursorEl || !document.body.contains(cursorEl)) {
      cursorEl = document.createElement('div');
      cursorEl.id = '__deep_browser_agent_cursor__';
      cursorEl.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
      `;
      document.body.appendChild(cursorEl);
    }
    return cursorEl;
  }

  function moveCursorTo(x, y) {
    const cursor = ensureCursor();
    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${x}px, ${y}px)`;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (cursorEl) cursorEl.style.opacity = '0';
    }, 4000);
  }

  function createClickRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = '__deep_browser_ripple__';
    ripple.style.left = `${x - 16}px`;
    ripple.style.top = `${y - 16}px`;
    ripple.style.width = '32px';
    ripple.style.height = '32px';
    document.body.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 450);
  }

  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'MOVE_AGENT_CURSOR') {
      moveCursorTo(msg.x, msg.y);
      if (msg.click) {
        setTimeout(() => createClickRipple(msg.x, msg.y), 260);
      }
    } else if (msg.type === 'HIDE_AGENT_CURSOR') {
      if (cursorEl) cursorEl.style.opacity = '0';
    }
  });
})();
