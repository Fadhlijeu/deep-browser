/**
 * Deep Browser Extension — DOM Perception & Extraction Service
 * ============================================================
 *
 * Scrapes interactive elements in the active browser tab:
 *   - Assigns stable 1-based indices [1], [2], ...
 *   - Computes precise viewport bounding rects
 *   - Extracts accessible labels (aria-label, placeholder, title, text)
 *   - Formats Simplified DOM Tree representation for LLM context
 *   - Computes scroll metrics (pixels_above, pixels_below, scroll_y)
 */

(function(global) {
  'use strict';

  class DomService {
    /**
     * Returns a self-contained function to be executed inside the target tab via chrome.scripting.
     */
    static getExtractionFunction() {
      return function extractDOMStateInTab() {
        const MAX_ELEMENTS = 120;
        const selectorMap = {};
        const elementsList = [];
        let indexCounter = 1;

        // Viewport and scroll dimensions
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const docHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
        const docWidth = Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.offsetWidth
        );

        const pixelsAbove = scrollY;
        const pixelsBelow = Math.max(0, docHeight - (scrollY + viewportHeight));

        // Interactive tag selectors
        const INTERACTIVE_SELECTORS = [
          'a[href]',
          'button',
          'input:not([type="hidden"])',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="tab"]',
          '[role="menuitem"]',
          '[role="combobox"]',
          '[role="searchbox"]',
          '[contenteditable="true"]',
          '[tabindex]:not([tabindex="-1"])',
          '[onclick]',
        ].join(',');

        function isVisible(el, rect) {
          if (!rect || rect.width <= 0 || rect.height <= 0) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          // Must be somewhat within or near the viewport
          if (rect.bottom < -200 || rect.top > viewportHeight + 400) return false;
          return true;
        }

        function getAccessibleText(el) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            return el.placeholder || el.value || el.getAttribute('aria-label') || el.name || '';
          }
          if (el.tagName === 'SELECT') {
            const selected = el.options[el.selectedIndex];
            return selected ? selected.text : el.getAttribute('aria-label') || '';
          }
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel.trim();
          const title = el.getAttribute('title');
          if (title) return title.trim();
          const alt = el.getAttribute('alt');
          if (alt) return alt.trim();
          return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function computeXPath(element) {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }
          if (element === document.body) {
            return '/html/body';
          }

          let ix = 0;
          const siblings = element.parentNode ? element.parentNode.childNodes : [];
          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
              const parentPath = element.parentNode ? computeXPath(element.parentNode) : '';
              return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
              ix++;
            }
          }
          return `//${element.tagName.toLowerCase()}`;
        }

        const candidates = document.querySelectorAll(INTERACTIVE_SELECTORS);

        candidates.forEach((el) => {
          if (indexCounter > MAX_ELEMENTS) return;

          const rect = el.getBoundingClientRect();
          if (!isVisible(el, rect)) return;

          const text = getAccessibleText(el).slice(0, 100);
          const tag = el.tagName.toLowerCase();
          const xpath = computeXPath(el);
          const idx = indexCounter++;

          el.setAttribute('data-deep-browser-idx', String(idx));

          const elementData = {
            index: idx,
            tag,
            type: el.getAttribute('type') || null,
            name: el.getAttribute('name') || null,
            id: el.id || null,
            placeholder: el.getAttribute('placeholder') || null,
            role: el.getAttribute('role') || null,
            href: el.getAttribute('href') || null,
            text,
            xpath,
            bounds: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
            },
          };

          elementsList.push(elementData);
          selectorMap[idx] = {
            xpath,
            tag,
            text,
            bounds: elementData.bounds,
          };
        });

        // Format Simplified DOM tree
        const simplifiedTreeLines = elementsList.map((item) => {
          let attrs = '';
          if (item.type) attrs += ` type="${item.type}"`;
          if (item.name) attrs += ` name="${item.name}"`;
          if (item.placeholder) attrs += ` placeholder="${item.placeholder}"`;
          if (item.role) attrs += ` role="${item.role}"`;
          if (item.href) attrs += ` href="${item.href.slice(0, 60)}"`;

          const content = item.text ? item.text : '';
          return `[${item.index}]<${item.tag}${attrs}>${content}</${item.tag}>`;
        });

        return {
          elements: elementsList,
          selectorMap,
          simplifiedTreeText: simplifiedTreeLines.join('\n'),
          pageInfo: {
            viewport_width: viewportWidth,
            viewport_height: viewportHeight,
            scroll_x: scrollX,
            scroll_y: scrollY,
            pixels_above: pixelsAbove,
            pixels_below: pixelsBelow,
            document_width: docWidth,
            document_height: docHeight,
          },
        };
      };
    }
  }

  global.DomService = DomService;
})(typeof window !== 'undefined' ? window : this);
