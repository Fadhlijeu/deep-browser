/**
 * Deep Browser Extension — Browser Use DOM Perception Engine (DomService)
 * =======================================================================
 *
 * Implements the core Browser Use DOM extraction algorithm in JavaScript:
 *   1. Traverses the DOM to discover interactive and semantic elements.
 *   2. Generates precise XPath expressions and 1-based selector indices.
 *   3. Computes layout bounding boxes & visibility criteria.
 *   4. Formats the Simplified DOM Tree representation for the LLM context:
 *        [index]<tag type="..." name="...">Visible text or value</tag>
 *   5. Caches the DOMSelectorMap for deterministic action resolution.
 */

(function(global) {
  'use strict';

  class DomService {
    /**
     * Script executed in the context of the target webpage to extract DOM state.
     * Must be serializable and self-contained.
     */
    static getExtractionFunction() {
      return function extractDOMStateInTab() {
        function getElementXPath(el) {
          if (el.id) {
            return '//*[@id="' + el.id.replace(/"/g, '\\"') + '"]';
          }
          const parts = [];
          let cur = el;
          while (cur && cur.nodeType === Node.ELEMENT_NODE) {
            let idx = 1;
            let sib = cur.previousElementSibling;
            while (sib) {
              if (sib.tagName === cur.tagName) idx++;
              sib = sib.previousElementSibling;
            }
            parts.unshift(cur.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
            cur = cur.parentElement;
          }
          return '/' + parts.join('/');
        }

        function isElementVisible(el) {
          if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return false;
          }
          return true;
        }

        const INTERACTIVE_SELECTORS = [
          'a[href]',
          'button:not([disabled])',
          'input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="combobox"]',
          '[role="textbox"]',
          '[role="searchbox"]',
          '[role="option"]',
          '[onclick]',
          '[tabindex]:not([tabindex="-1"])',
          'summary',
          'details',
        ].join(',');

        const allCandidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS));
        const elements = [];
        const selectorMap = {};
        const seen = new Set();
        let counter = 1;

        for (const el of allCandidates) {
          if (seen.has(el)) continue;
          seen.add(el);

          if (!isElementVisible(el)) continue;

          const rect = el.getBoundingClientRect();
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || '';
          const role = el.getAttribute('role') || '';
          const name = el.getAttribute('name') || '';
          const id = el.id || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
          const href = el.href || el.getAttribute('href') || '';
          const value = ['input', 'select', 'textarea'].includes(tag) ? el.value : '';

          let text = (el.innerText || ariaLabel || placeholder || value || '').trim();
          if (text.length > 140) text = text.slice(0, 140) + '...';

          const xpath = getElementXPath(el);
          const index = counter++;

          const elemData = {
            index,
            tag,
            type,
            role,
            name,
            id,
            placeholder,
            ariaLabel,
            href,
            value,
            text,
            xpath,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };

          elements.push(elemData);
          selectorMap[index] = elemData;
        }

        // Viewport & scroll metrics
        const docEl = document.documentElement;
        const body = document.body;
        const scrollX = window.scrollX || (docEl && docEl.scrollLeft) || (body && body.scrollLeft) || 0;
        const scrollY = window.scrollY || (docEl && docEl.scrollTop) || (body && body.scrollTop) || 0;
        const viewW = window.innerWidth || (docEl && docEl.clientWidth) || 1280;
        const viewH = window.innerHeight || (docEl && docEl.clientHeight) || 800;
        const totalH = Math.max(
          (docEl && docEl.scrollHeight) || 0,
          (body && body.scrollHeight) || 0,
          viewH
        );

        const pageInfo = {
          viewport_width: viewW,
          viewport_height: viewH,
          scroll_x: Math.round(scrollX),
          scroll_y: Math.round(scrollY),
          page_height: Math.round(totalH),
          pixels_above: Math.round(scrollY),
          pixels_below: Math.max(0, Math.round(totalH - (scrollY + viewH))),
        };

        // Build Simplified DOM Tree String
        const treeLines = elements.map(e => {
          const attrs = [];
          if (e.type) attrs.push(`type="${e.type}"`);
          if (e.role) attrs.push(`role="${e.role}"`);
          if (e.name) attrs.push(`name="${e.name}"`);
          if (e.placeholder) attrs.push(`placeholder="${e.placeholder}"`);
          if (e.ariaLabel && e.ariaLabel !== e.text) attrs.push(`aria-label="${e.ariaLabel}"`);
          if (e.value) attrs.push(`value="${e.value}"`);

          const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
          const bodyText = e.text ? `${e.text}` : '';
          return `[${e.index}]<${e.tag}${attrStr}>${bodyText}</${e.tag}>`;
        });

        return {
          url: location.href,
          title: document.title || location.href,
          elements,
          selectorMap,
          simplifiedTreeText: treeLines.join('\n'),
          pageInfo,
        };
      };
    }

    /**
     * Extracts the complete DOM state from the given Chrome tab.
     * @param {number} tabId
     * @returns {Promise<Object>}
     */
    static async extractFromTab(tabId) {
      if (!tabId) throw new Error('DomService.extractFromTab requires a valid tabId');

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: DomService.getExtractionFunction(),
        });

        if (!results || !results[0] || !results[0].result) {
          throw new Error('Script execution returned empty DOM state');
        }

        return results[0].result;
      } catch (err) {
        // Fallback for special / restricted tabs
        return {
          url: '',
          title: 'Restricted Page',
          elements: [],
          selectorMap: {},
          simplifiedTreeText: '(Halaman ini memblokir akses script atau merupakan tab khusus)',
          pageInfo: { viewport_width: 1280, viewport_height: 800, pixels_above: 0, pixels_below: 0 },
          error: err.message,
        };
      }
    }
  }

  global.DomService = DomService;
})(typeof window !== 'undefined' ? window : this);
