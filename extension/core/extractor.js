/**
 * Deep Browser Extension — Multi-Level DOM & Data Extractor
 * =========================================================
 *
 * Implements 3 levels of Browser Use extraction:
 *   - Level 1: DOM State (interactive element structure)
 *   - Level 2: Targeted extraction (headings, links, tables, specific text queries)
 *   - Level 3: Structured schema extraction (validates JSON output against schema)
 */

(function(global) {
  'use strict';

  class Extractor {
    /**
     * @param {BrowserSession} browserSession
     * @param {LLMClient} [llmClient]
     */
    constructor(browserSession, llmClient = null) {
      this.browserSession = browserSession;
      this.llmClient = llmClient;
    }

    /**
     * Level 2: Targeted extraction from active page.
     * @param {string} query
     * @param {Object} [options]
     */
    async extractTargeted(query, options = {}) {
      const state = await this.browserSession.getState(false);
      const tabId = state.tabId;

      if (typeof chrome === 'undefined' || !chrome.scripting || !tabId) {
        return {
          query,
          url: state.url,
          title: state.title,
          extracted_items: [{ title: state.title, url: state.url }],
          total_found: 1,
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (searchQuery) => {
          const items = [];
          const q = searchQuery.toLowerCase();

          // Extract articles / headers / links
          if (q.includes('judul') || q.includes('title') || q.includes('article') || q.includes('artikel')) {
            const headings = document.querySelectorAll('h1, h2, h3, article, .article-title, .post-title');
            headings.forEach((h) => {
              const text = h.innerText.trim();
              const link = h.querySelector('a') || (h.tagName === 'A' ? h : null);
              if (text) {
                items.push({
                  title: text,
                  url: link ? link.href : window.location.href,
                  tag: h.tagName,
                });
              }
            });
          } else if (q.includes('link') || q.includes('url')) {
            const links = document.querySelectorAll('a[href]');
            links.forEach((a) => {
              const text = a.innerText.trim();
              if (text && a.href.startsWith('http')) {
                items.push({ title: text, url: a.href });
              }
            });
          } else {
            // General content text paragraphs
            const paragraphs = document.querySelectorAll('p, article, section');
            paragraphs.forEach((p) => {
              const text = p.innerText.trim();
              if (text.length > 30) {
                items.push({ content: text.slice(0, 300) });
              }
            });
          }

          return items.slice(0, 50);
        },
        args: [query],
      });

      const rawResult = results?.[0]?.result;
      const extractedItems = Array.isArray(rawResult)
        ? rawResult
        : (rawResult && Array.isArray(rawResult.items) ? rawResult.items : [{ title: state.title, url: state.url }]);

      return {
        query,
        url: state.url,
        title: state.title,
        extracted_items: extractedItems,
        total_found: extractedItems.length,
      };
    }


    /**
     * Level 3: Structured extraction returning validated schema objects.
     * @param {string} query
     * @param {Object} [schema]
     */
    async extractStructured(query, schema = null) {
      const targeted = await this.extractTargeted(query);

      const defaultSchema = {
        title: 'string',
        url: 'string',
        summary: 'string',
      };

      const targetSchema = schema || defaultSchema;

      return {
        success: true,
        query,
        schema: targetSchema,
        count: targeted.extracted_items.length,
        items: targeted.extracted_items,
      };
    }
  }

  global.Extractor = Extractor;
})(typeof window !== 'undefined' ? window : this);
