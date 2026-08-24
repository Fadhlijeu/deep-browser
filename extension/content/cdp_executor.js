/**
 * Deep-Browser Content Script: CDP Command Executor
 * ===================================================
 * Receives DEEP_BROWSER_CMD messages from the sidepanel (via chrome.tabs.sendMessage)
 * and executes DOM interactions directly on the active page.
 *
 * Commands handled:
 *   GET_DOM_STATE    — extract interactive elements + page geometry
 *   CLICK            — click element by index or xpath
 *   CLICK_COORDINATE — click at absolute page coordinates
 *   TYPE             — type text into an input
 *   SCROLL           — scroll the page
 *   SCROLL_TO_TEXT   — scroll until text is visible
 *   SEND_KEYS        — dispatch keyboard events
 *   GO_BACK          — history.back()
 *   GO_FORWARD       — history.forward()
 */

'use strict';

// ─── Index Registry ───────────────────────────────────────────────────────────
let _elementIndex = {};

// ─── Interactive Element Extraction ──────────────────────────────────────────
const INTERACTIVE_ROLES = new Set(['button','link','checkbox','radio','textbox','combobox','menuitem','option','tab','switch','slider','searchbox']);

function isInteractive(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName.toLowerCase();
  if (['a','button','input','select','textarea','details','summary'].includes(tag)) return true;
  const role = el.getAttribute('role');
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (el.hasAttribute('onclick') || el.hasAttribute('href')) return true;
  const ti = el.getAttribute('tabindex');
  if (ti !== null && parseInt(ti, 10) >= 0) return true;
  return false;
}

function getXPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    let idx = 1;
    let sib = node.previousSibling;
    while (sib) { if (sib.nodeType === 1 && sib.nodeName === node.nodeName) idx++; sib = sib.previousSibling; }
    parts.unshift(idx > 1 ? `${node.nodeName.toLowerCase()}[${idx}]` : node.nodeName.toLowerCase());
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

function extractInteractiveElements() {
  _elementIndex = {};
  const results = [];
  let idx = 1;
  const all = document.querySelectorAll('a,button,input,select,textarea,details,summary,[role],[onclick],[tabindex],[href]');
  for (const el of all) {
    if (!isInteractive(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.01) continue;

    const tag = el.tagName.toLowerCase();
    const text = (el.innerText || el.textContent || el.value || el.placeholder || el.title || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 150);
    _elementIndex[idx] = el;
    results.push({
      index: idx,
      tag,
      text,
      type:        el.getAttribute('type') || '',
      role:        el.getAttribute('role') || '',
      href:        el.getAttribute('href') || '',
      placeholder: el.getAttribute('placeholder') || '',
      name:        el.getAttribute('name') || el.getAttribute('id') || '',
      value:       el.value || '',
      xpath:       getXPath(el),
      rect: {
        top:    Math.round(rect.top  + window.scrollY),
        left:   Math.round(rect.left + window.scrollX),
        width:  Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
    idx++;
  }
  return results;
}

function getPageInfo() {
  return {
    viewport_width:  window.innerWidth,
    viewport_height: window.innerHeight,
    page_width:      document.body.scrollWidth,
    page_height:     document.body.scrollHeight,
    scroll_x:        window.scrollX,
    scroll_y:        window.scrollY,
    pixels_above:    window.scrollY,
    pixels_below:    Math.max(0, document.body.scrollHeight - window.innerHeight - window.scrollY),
  };
}

// ─── Element Resolution ───────────────────────────────────────────────────────
function resolveElement(index, xpath) {
  if (index && _elementIndex[index]) return _elementIndex[index];
  if (xpath) {
    try {
      const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res.singleNodeValue) return res.singleNodeValue;
    } catch (_) {}
  }
  if (index) {
    extractInteractiveElements();
    return _elementIndex[index] || null;
  }
  return null;
}

// ─── Interaction Helpers ──────────────────────────────────────────────────────
function simulateClick(el, button = 'left') {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const btn = button === 'right' ? 2 : button === 'middle' ? 1 : 0;
  ['mouseover','mousedown','mouseup'].forEach(evType =>
    el.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: btn }))
  );
  if (btn === 0) {
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  }
}

function simulateType(el, text, clear) {
  el.focus();
  if (clear) {
    if (typeof el.select === 'function') el.select();
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  for (const ch of text) {
    el.dispatchEvent(new KeyboardEvent('keydown',  { key: ch, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }));
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value += ch;
    el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── Message Handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'DEEP_BROWSER_CMD') return false;
  const { command, index, xpath, text, clear, direction, amount, keys, x, y, button } = msg;

  (async () => {
    try {
      switch (command) {

        case 'GET_DOM_STATE': {
          sendResponse({ elements: extractInteractiveElements(), pageInfo: getPageInfo() });
          break;
        }

        case 'CLICK': {
          const el = resolveElement(index, xpath);
          if (!el) throw new Error(`Element [${index}] not found`);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 120));
          simulateClick(el, button || 'left');
          sendResponse({ success: true, index });
          break;
        }

        case 'CLICK_COORDINATE': {
          const el = document.elementFromPoint(x - window.scrollX, y - window.scrollY);
          if (el) simulateClick(el, button || 'left');
          else document.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x - window.scrollX, clientY: y - window.scrollY }));
          sendResponse({ success: true, x, y });
          break;
        }

        case 'TYPE': {
          const el = resolveElement(index, xpath);
          if (!el) throw new Error(`Element [${index}] not found for typing`);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 80));
          simulateType(el, text || '', !!clear);
          sendResponse({ success: true, index });
          break;
        }

        case 'SCROLL': {
          const px = amount || 300;
          const down = !(direction || '').toLowerCase().startsWith('up');
          window.scrollBy({ top: down ? px : -px, behavior: 'smooth' });
          sendResponse({ success: true, direction, amount: px });
          break;
        }

        case 'SCROLL_TO_TEXT': {
          const needle = (text || '').toLowerCase();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          let node = walker.nextNode();
          let found = false;
          while (node) {
            if (node.textContent.toLowerCase().includes(needle)) {
              const parent = node.parentElement;
              if (parent) { parent.scrollIntoView({ behavior: 'smooth', block: 'center' }); found = true; break; }
            }
            node = walker.nextNode();
          }
          sendResponse({ success: found, found });
          break;
        }

        case 'SEND_KEYS': {
          const active = document.activeElement || document.body;
          for (const key of (keys || '').split(/\s*\+\s*/)) {
            active.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            active.dispatchEvent(new KeyboardEvent('keyup',   { key, bubbles: true }));
          }
          sendResponse({ success: true, keys });
          break;
        }

        case 'GO_BACK':    history.back();    sendResponse({ success: true }); break;
        case 'GO_FORWARD': history.forward(); sendResponse({ success: true }); break;

        case 'GET_PAGE_HTML': {
          sendResponse({
            html: document.documentElement.outerHTML,
            title: document.title,
            url: window.location.href,
          });
          break;
        }

        case 'EXTRACT_PAGE_CONTENT': {
          const bodyText = document.body ? document.body.innerText : '';
          sendResponse({
            title: document.title,
            url: window.location.href,
            text: bodyText.slice(0, 20000),
          });
          break;
        }

        default:
          sendResponse({ error: `Unknown command: ${command}` });
      }
    } catch (err) {
      sendResponse({ error: err.message || String(err) });
    }

  })();

  return true; // keep channel open for async response
});

console.log('[Deep-Browser] CDP executor ready on', window.location.href);
