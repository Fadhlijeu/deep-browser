/**
 * Deep Browser Extension — BrowserSession Abstraction
 * ====================================================
 *
 * Implements the BrowserSession abstraction for the Chrome Extension runtime.
 * Provides high-level browser operations over Chrome extension APIs:
 *   - DOM State & Screenshot perception
 *   - Tab lifecycle and navigation
 *   - Element interaction (click, type, scroll, sendKeys)
 *   - Coordinate clicks and textual scrolling
 */

(function(global) {
  'use strict';

  class BrowserSession {
    /**
     * @param {Object} options
     * @param {number} [options.tabId]
     * @param {number} [options.windowId]
     */
    constructor(options = {}) {
      this.tabId = options.tabId || null;
      this.windowId = options.windowId || null;
      this.currentUrl = 'about:blank';
      this.currentTitle = '';
      this.cachedSelectorMap = {};
      this.lastDOMState = null;
    }

    /**
     * Attaches to the active tab or a specific tab.
     */
    async attach() {
      if (this.tabId) {
        try {
          const tab = await chrome.tabs.get(this.tabId);
          this.windowId = tab.windowId;
          this.currentUrl = tab.url || 'about:blank';
          this.currentTitle = tab.title || '';
          return tab;
        } catch (e) {
          // Fallback to active tab
        }
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0]) {
        const tab = tabs[0];
        this.tabId = tab.id;
        this.windowId = tab.windowId;
        this.currentUrl = tab.url || 'about:blank';
        this.currentTitle = tab.title || '';
        return tab;
      }

      throw new Error('No active Chrome tab found to attach BrowserSession');
    }

    /**
     * Captures DOM state and visible screenshot of the tab.
     * @param {boolean} [includeScreenshot=true]
     * @returns {Promise<Object>}
     */
    async getState(includeScreenshot = true) {
      await this.attach();

      const domData = await global.DomService.extractFromTab(this.tabId);
      this.currentUrl = domData.url || this.currentUrl;
      this.currentTitle = domData.title || this.currentTitle;
      this.cachedSelectorMap = domData.selectorMap || {};
      this.lastDOMState = domData;

      let screenshot = null;
      if (includeScreenshot && this.windowId) {
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(this.windowId, { format: 'png' });
          if (dataUrl && dataUrl.includes(',')) {
            screenshot = dataUrl.split(',')[1]; // Strip base64 prefix
          }
        } catch (e) {
          console.warn('[BrowserSession] Screenshot capture skipped/failed:', e.message);
        }
      }

      const tabsList = await chrome.tabs.query({ currentWindow: true }).catch(() => []);

      return {
        url: this.currentUrl,
        title: this.currentTitle,
        tabs: tabsList.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.id === this.tabId })),
        elements: domData.elements || [],
        selectorMap: domData.selectorMap || {},
        simplifiedTreeText: domData.simplifiedTreeText || '',
        pageInfo: domData.pageInfo || {},
        screenshot,
      };
    }

    /**
     * Navigates the current tab to a URL or opens in a new tab.
     */
    async navigate(url, newTab = false) {
      if (!url) throw new Error('navigate() requires a url');

      // Auto-prefix http/https if missing
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl) && !/^about:/i.test(targetUrl) && !/^file:/i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      if (newTab) {
        const created = await chrome.tabs.create({ url: targetUrl });
        this.tabId = created.id;
        this.windowId = created.windowId;
        this.currentUrl = targetUrl;
        return { success: true, url: targetUrl, tabId: created.id };
      }

      await this.attach();
      await chrome.tabs.update(this.tabId, { url: targetUrl });

      // Wait for page load completion
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === this.tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.tabs.get(tabId, t => {
              if (t) {
                this.currentUrl = t.url || targetUrl;
                this.currentTitle = t.title || '';
              }
              resolve();
            });
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 12000); // 12s safety timeout
      });

      return { success: true, url: targetUrl };
    }

    /**
     * Clicks an interactive element identified by index or XPath.
     */
    async click(index, xpath) {
      await this.attach();

      // Resolve xpath from cached selector map if missing
      let targetXpath = xpath || null;
      if (!targetXpath && index != null && this.cachedSelectorMap[index]) {
        targetXpath = this.cachedSelectorMap[index].xpath;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (idx, xp) => {
          let el = null;
          if (xp) {
            try {
              const res = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              el = res.singleNodeValue;
            } catch {}
          }
          if (!el && idx != null) {
            const selector = 'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [onclick]';
            const matches = Array.from(document.querySelectorAll(selector)).filter(e => {
              const rect = e.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            el = matches[idx - 1];
          }

          if (!el) {
            return { success: false, error: `Element [${idx}] not found on page` };
          }

          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();

          const events = ['mousedown', 'mouseup', 'click'];
          for (const ev of events) {
            el.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
          }

          return { success: true, tag: el.tagName.toLowerCase() };
        },
        args: [index, targetXpath],
      });

      return results?.[0]?.result || { success: false, error: 'Click script returned empty result' };
    }

    /**
     * Clicks at specific viewport coordinates.
     */
    async clickCoordinate(x, y) {
      await this.attach();

      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (cx, cy) => {
          const el = document.elementFromPoint(cx, cy);
          if (!el) return { success: false, error: `No element at coordinates (${cx}, ${cy})` };
          el.focus();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
          return { success: true, tag: el.tagName.toLowerCase() };
        },
        args: [x, y],
      });

      return results?.[0]?.result || { success: false, error: 'Coordinate click failed' };
    }

    /**
     * Types text into an input or textarea element.
     */
    async typeText(index, text, clear = true, xpath = null) {
      await this.attach();

      let targetXpath = xpath || null;
      if (!targetXpath && index != null && this.cachedSelectorMap[index]) {
        targetXpath = this.cachedSelectorMap[index].xpath;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (idx, txt, clr, xp) => {
          let el = null;
          if (xp) {
            try {
              const res = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              el = res.singleNodeValue;
            } catch {}
          }
          if (!el && idx != null) {
            const selector = 'input:not([type="hidden"]), textarea, select, [contenteditable="true"]';
            const matches = Array.from(document.querySelectorAll(selector)).filter(e => {
              const rect = e.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            el = matches[idx - 1];
          }

          if (!el) {
            return { success: false, error: `Input element [${idx}] not found` };
          }

          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();

          if (clr) {
            el.value = '';
            if (el.isContentEditable) el.innerText = '';
          }

          const strVal = String(txt || '');
          if (el.isContentEditable) {
            el.innerText = (clr ? '' : el.innerText) + strVal;
          } else {
            el.value = (clr ? '' : (el.value || '')) + strVal;
          }

          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, text: strVal };
        },
        args: [index, text, clear !== false, targetXpath],
      });

      return results?.[0]?.result || { success: false, error: 'Type script returned empty result' };
    }

    /**
     * Scrolls the window in the given direction.
     */
    async scroll(direction = 'down', amount = 450) {
      await this.attach();
      const amt = Number(amount) || 450;
      const dir = direction === 'up' ? -amt : amt;

      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (d) => window.scrollBy({ top: d, behavior: 'smooth' }),
        args: [dir],
      });

      await new Promise(r => setTimeout(r, 400));
      return { success: true, direction, amount: amt };
    }

    /**
     * Finds text on the page and scrolls it into view.
     */
    async scrollToText(text) {
      await this.attach();

      const results = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (txt) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent && node.textContent.toLowerCase().includes(txt.toLowerCase())) {
              const parent = node.parentElement;
              if (parent) {
                parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return { success: true };
              }
            }
          }
          return { success: false, error: `Text "${txt}" not found on page` };
        },
        args: [text],
      });

      return results?.[0]?.result || { success: false, error: 'Scroll to text failed' };
    }

    /**
     * Dispatches keyboard keys to active element.
     */
    async sendKeys(keys = 'Enter') {
      await this.attach();

      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (k) => {
          const target = document.activeElement || document.body;
          const keyEvtInit = { key: k, code: 'Key' + k, bubbles: true, cancelable: true };
          target.dispatchEvent(new KeyboardEvent('keydown', keyEvtInit));
          target.dispatchEvent(new KeyboardEvent('keypress', keyEvtInit));
          target.dispatchEvent(new KeyboardEvent('keyup', keyEvtInit));

          // If Enter inside form, trigger submit if applicable
          if (k === 'Enter' && target.form) {
            target.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        },
        args: [keys],
      });

      return { success: true, keys };
    }

    async refresh() {
      await this.attach();
      await chrome.tabs.reload(this.tabId);
      await new Promise(r => setTimeout(r, 1000));
      return { success: true };
    }

    async goBack() {
      await this.attach();
      await chrome.tabs.goBack(this.tabId);
      await new Promise(r => setTimeout(r, 1000));
      return { success: true };
    }

    async goForward() {
      await this.attach();
      await chrome.tabs.goForward(this.tabId);
      await new Promise(r => setTimeout(r, 1000));
      return { success: true };
    }

    async switchTab(tabId) {
      const tid = Number(tabId);
      await chrome.tabs.update(tid, { active: true });
      this.tabId = tid;
      return { success: true, tabId: tid };
    }

    async closeTab(tabId) {
      const tid = Number(tabId || this.tabId);
      await chrome.tabs.remove(tid);
      return { success: true };
    }
  }

  global.BrowserSession = BrowserSession;
})(typeof window !== 'undefined' ? window : this);
