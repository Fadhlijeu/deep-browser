/**
 * Deep Browser Extension — Tools & Action Dispatcher
 * ===================================================
 *
 * Full Browser Use action registry and execution engine:
 *   - Navigation: navigate, go_back, go_forward, refresh, switch_tab, open_tab, close_tab
 *   - Interaction: click_element, click_coordinate, input_text, send_keys, select_dropdown_option, get_dropdown_options, hover
 *   - Scrolling: scroll_page, find_text
 *   - Visual & Media: screenshot, save_as_pdf
 *   - Fast Extraction & Grep: extract, extract_html_snippet, search_page, find_elements, evaluate
 *   - Flow & Interaction: ask_user, wait, done
 */

(function(global) {
  'use strict';

  class Tools {
    /**
     * @param {BrowserSession} browserSession
     */
    constructor(browserSession) {
      this.browserSession = browserSession;
    }

    /**
     * Returns full Browser Use action schemas for system prompt & LLM tools definition.
     */
    static getActionSchemas() {
      return [
        {
          name: 'click_element',
          description: 'Click an element on the active webpage by its 1-based index [1], [2], etc.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'The 1-based element index from the Simplified DOM snapshot.' },
            },
            required: ['index'],
          },
        },
        {
          name: 'click_coordinate',
          description: 'Click at specific viewport coordinates (x, y). Use only as fallback when index is not available.',
          parameters: {
            type: 'object',
            properties: {
              coordinate_x: { type: 'integer', description: 'Horizontal coordinate relative to viewport left.' },
              coordinate_y: { type: 'integer', description: 'Vertical coordinate relative to viewport top.' },
            },
            required: ['coordinate_x', 'coordinate_y'],
          },
        },
        {
          name: 'input_text',
          description: 'Input text into an interactive input, textarea, or contenteditable element.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'Element index from DOM snapshot.' },
              text: { type: 'string', description: 'Text string to type into the element.' },
              clear: { type: 'boolean', description: 'Whether to clear existing text first (default: true).' },
            },
            required: ['index', 'text'],
          },
        },
        {
          name: 'navigate',
          description: 'Navigate to a specific URL in the current tab or a new tab.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Full URL including https://' },
              new_tab: { type: 'boolean', description: 'Whether to open in a new tab (default: false).' },
            },
            required: ['url'],
          },
        },
        {
          name: 'scroll_page',
          description: 'Scroll the page smoothly in human-like motion up or down.',
          parameters: {
            type: 'object',
            properties: {
              down: { type: 'boolean', description: 'true to scroll down, false to scroll up (default: true).' },
              pages: { type: 'number', description: 'Number of viewport pages to scroll (e.g. 0.5, 1.0, 2.0).' },
              index: { type: 'integer', description: 'Optional element index to scroll within.' },
            },
          },
        },
        {
          name: 'send_keys',
          description: 'Send special keys or keyboard shortcuts (e.g. "Enter", "Escape", "Control+a", "Tab").',
          parameters: {
            type: 'object',
            properties: {
              keys: { type: 'string', description: 'Key name or shortcut combination.' },
            },
            required: ['keys'],
          },
        },
        {
          name: 'switch_tab',
          description: 'Switch to a specific browser tab by its tabId.',
          parameters: {
            type: 'object',
            properties: {
              tab_id: { type: 'string', description: 'Tab ID to switch to.' },
            },
            required: ['tab_id'],
          },
        },
        {
          name: 'open_tab',
          description: 'Open a new tab in Microsoft Edge with the specified URL and switch to it.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to open in a new tab.' },
            },
            required: ['url'],
          },
        },
        {
          name: 'close_tab',
          description: 'Close a tab by its tabId (or current tab if omitted).',
          parameters: {
            type: 'object',
            properties: {
              tab_id: { type: 'string', description: 'Tab ID to close.' },
            },
          },
        },
        {
          name: 'screenshot',
          description: 'Capture a screenshot of the visible webpage viewport and display it directly in chat.',
          parameters: {
            type: 'object',
            properties: {
              file_name: { type: 'string', description: 'Optional filename for the screenshot.' },
            },
          },
        },
        {
          name: 'save_as_pdf',
          description: 'Save the current page content as a printable PDF document and send the download badge to chat.',
          parameters: {
            type: 'object',
            properties: {
              file_name: { type: 'string', description: 'PDF file name (e.g. "biodata_mahasiswa.pdf").' },
            },
          },
        },
        {
          name: 'extract_html_snippet',
          description: 'Extract visual HTML & CSS structure of a specific section (e.g. biodata, info card, table, product details) and render it as a styled rich snippet in chat.',
          parameters: {
            type: 'object',
            properties: {
              selector_or_keyword: { type: 'string', description: 'CSS selector (e.g. ".card", "#info") or text keywords to locate the section.' },
              title: { type: 'string', description: 'Title or label for the extracted snippet card.' },
            },
            required: ['selector_or_keyword'],
          },
        },
        {
          name: 'search_page',
          description: 'Fast zero-LLM grep search in page text for a pattern with surrounding context.',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Text or regex pattern to search for.' },
              is_regex: { type: 'boolean', description: 'Treat pattern as regular expression (default: false).' },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'find_elements',
          description: 'Fast zero-LLM DOM query returning matching elements by CSS selector.',
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector (e.g. "table tr", "a.link").' },
              attributes: { type: 'array', items: { type: 'string' }, description: 'Attributes to extract (e.g. ["href", "src"]).' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'evaluate',
          description: 'Execute arbitrary browser JavaScript in the active page context and return the result.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'JavaScript code expression or IIFE to execute.' },
            },
            required: ['code'],
          },
        },
        {
          name: 'get_dropdown_options',
          description: 'Get all available selectable options from a dropdown <select> element.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'Dropdown element index.' },
            },
            required: ['index'],
          },
        },
        {
          name: 'select_dropdown_option',
          description: 'Select an option from a dropdown element by exact text or value.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'Dropdown element index.' },
              text: { type: 'string', description: 'Exact text or value of the option to select.' },
            },
            required: ['index', 'text'],
          },
        },
        {
          name: 'extract',
          description: 'Extract specific data, structured items, or page text from the active page.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'What information or items to extract.' },
              extract_links: { type: 'boolean', description: 'Whether to include links in extracted markdown.' },
            },
            required: ['query'],
          },
        },
        {
          name: 'hover',
          description: 'Hover the mouse pointer over an element.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'integer', description: 'Element index to hover over.' },
            },
            required: ['index'],
          },
        },
        {
          name: 'wait',
          description: 'Wait for a specified duration in seconds for dynamic content to load.',
          parameters: {
            type: 'object',
            properties: {
              seconds: { type: 'number', description: 'Seconds to wait (e.g. 2, 5).' },
            },
          },
        },
        {
          name: 'ask_user',
          description: 'Ask the user a structured question or request confirmation using an interactive widget (choice, confirm, text_input).',
          parameters: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['choice', 'multi_choice', 'confirm', 'text_input', 'number_input', 'waiting'], description: 'Widget type.' },
              question: { type: 'string', description: 'Question or message to display.' },
              options: { type: 'array', items: { type: 'string' }, description: 'Options for choice or multi_choice.' },
            },
            required: ['type', 'question'],
          },
        },
        {
          name: 'done',
          description: 'Conclude the autonomous task when the user goal is completely achieved.',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Final response message or summary of results to the user.' },
              success: { type: 'boolean', description: 'Whether the task completed successfully (default: true).' },
            },
            required: ['text'],
          },
        },
      ];
    }

    /**
     * Executes a tool action by name with the given parameters.
     * @param {string} actionName
     * @param {Object} params
     * @returns {Promise<Object>} { success, error, data }
     */
    async execute(actionName, params = {}) {
      try {
        switch (actionName) {
          case 'click_element':
          case 'click': {
            const index = this._requireIndex(params);
            const res = await this.browserSession.click(index);
            if (res.error) return { success: false, error: res.error };
            return { success: true, message: `Clicked element [${index}] (${res.tagName || ''})`, data: res };
          }

          case 'click_coordinate': {
            const x = params.coordinate_x ?? params.x;
            const y = params.coordinate_y ?? params.y;
            if (x == null || y == null) return { success: false, error: 'click_coordinate requires coordinate_x and coordinate_y' };
            const res = await this.browserSession.clickCoordinate(x, y);
            return { success: res.success !== false, message: `Clicked coordinate (${x}, ${y})`, data: res };
          }

          case 'input_text':
          case 'type': {
            const index = this._requireIndex(params);
            const text = String(params.text ?? '');
            const clear = params.clear !== false;
            const res = await this.browserSession.typeText(index, text, clear);
            if (res.error) return { success: false, error: res.error };
            return { success: true, message: `Typed "${text}" into element [${index}]`, data: res };
          }

          case 'navigate':
          case 'go_to_url': {
            const url = params.url || params.target;
            if (!url) return { success: false, error: 'navigate requires "url" parameter' };
            const res = await this.browserSession.navigate(url, !!params.new_tab);
            return { success: true, message: `Navigated to ${url}`, data: res };
          }

          case 'scroll_page':
          case 'scroll': {
            const down = params.down !== false;
            const pages = parseFloat(params.pages) || 1.0;
            const index = params.index != null ? parseInt(params.index, 10) : null;
            const res = await this.browserSession.smoothScroll(down, pages, index);
            return { success: true, message: `Scrolled ${down ? 'down' : 'up'} ${pages} pages`, data: res };
          }

          case 'send_keys': {
            const keys = params.keys || params.key;
            if (!keys) return { success: false, error: 'send_keys requires "keys" parameter' };
            const res = await this.browserSession.sendKeys(keys);
            return { success: true, message: `Sent keys: ${keys}`, data: res };
          }

          case 'switch_tab': {
            const tabId = params.tab_id || params.tabId;
            if (!tabId) return { success: false, error: 'switch_tab requires "tab_id"' };
            const res = await this.browserSession.switchTab(tabId);
            return { success: true, message: `Switched to tab ${tabId}`, data: res };
          }

          case 'open_tab':
          case 'create_tab':
          case 'new_tab': {
            const url = String(params.url || 'https://www.google.com');
            const res = await this.browserSession.createTab(url);
            return { success: true, message: `Opened new tab: ${url}`, data: res };
          }

          case 'close_tab': {
            const tabId = params.tab_id || params.tabId || null;
            const res = await this.browserSession.closeTab(tabId);
            return { success: true, message: `Closed tab ${tabId || 'active'}`, data: res };
          }

          case 'screenshot':
          case 'take_screenshot': {
            const res = await this.browserSession.takeScreenshot();
            if (!res.success) return { success: false, error: res.error };
            return {
              success: true,
              message: 'Screenshot captured.',
              data: {
                screenshotDataUrl: res.screenshotDataUrl,
                fileName: params.file_name || `screenshot_${Date.now()}.png`,
              },
            };
          }

          case 'save_as_pdf': {
            const res = await this.browserSession.saveAsPdf(params);
            return {
              success: true,
              message: res.message || 'Page saved as PDF.',
              data: res,
            };
          }

          case 'extract_html_snippet': {
            const query = params.selector_or_keyword || params.selector || params.query || '';
            const res = await this.browserSession.extractHtmlSnippet(query);
            if (!res.success) return { success: false, error: res.error };
            return {
              success: true,
              message: `Extracted visual snippet for "${query}"`,
              data: {
                title: params.title || `Struktur Informasi: ${query}`,
                html: res.html,
                text: res.text,
              },
            };
          }

          case 'search_page': {
            const pattern = params.pattern || '';
            const isRegex = !!params.is_regex;
            const res = await this.browserSession.searchPage(pattern, isRegex);
            return { success: true, message: `Found ${res.totalMatches || 0} matches for "${pattern}"`, data: res };
          }

          case 'find_elements': {
            const sel = params.selector || '*';
            const res = await this.browserSession.findElements(sel, params.attributes);
            return { success: true, message: `Found ${res.total || 0} elements matching "${sel}"`, data: res };
          }

          case 'evaluate': {
            const code = params.code || '';
            const res = await this.browserSession.evaluateScript(code);
            return { success: true, message: 'Script executed.', data: res };
          }

          case 'get_dropdown_options': {
            const index = this._requireIndex(params);
            const res = await this.browserSession.getDropdownOptions(index);
            return { success: res.success !== false, message: `Retrieved dropdown options for [${index}]`, data: res };
          }

          case 'select_dropdown_option': {
            const index = this._requireIndex(params);
            const text = String(params.text || params.value || '');
            const res = await this.browserSession.selectDropdownOption(index, text);
            return { success: res.success !== false, message: `Selected "${text}" in [${index}]`, data: res };
          }

          case 'hover': {
            const index = this._requireIndex(params);
            const res = await this.browserSession.hover(index);
            return { success: true, message: `Hovered over element [${index}]`, data: res };
          }

          case 'wait': {
            const seconds = parseFloat(params.seconds) || 2;
            await this.browserSession.wait(seconds);
            return { success: true, message: `Waited for ${seconds}s`, data: { seconds } };
          }

          case 'extract': {
            const query = String(params.query || 'extract text');
            const state = await this.browserSession.getState(false);
            return {
              success: true,
              message: `Extracted content for query: "${query}"`,
              data: {
                query,
                url: state.url,
                title: state.title,
                summary: state.simplifiedTreeText.slice(0, 500),
              },
            };
          }

          case 'ask_user': {
            // Handled at agent step level, but safe fallback here
            return {
              success: true,
              message: `Question asked to user: ${params.question || ''}`,
              data: { is_interaction: true, ...params },
            };
          }

          case 'done': {
            const text = String(params.text || params.answer || params.result || 'Task finished.');
            const success = params.success !== false;
            return {
              success: true,
              message: 'Task completed.',
              data: { is_done: true, text, success },
            };
          }

          default:
            return { success: false, error: `Unknown action: "${actionName}"` };
        }
      } catch (err) {
        return { success: false, error: err.message || String(err) };
      }
    }

    _requireIndex(params) {
      const idx = params.index ?? params.element_index ?? params.id;
      const num = parseInt(idx, 10);
      if (isNaN(num)) {
        throw new Error(`Action requires a valid numeric index, received: ${JSON.stringify(idx)}`);
      }
      return num;
    }
  }

  global.Tools = Tools;
})(typeof window !== 'undefined' ? window : this);
