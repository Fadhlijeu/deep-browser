/**
 * Deep Browser Extension — Tools & Action Dispatcher
 * ===================================================
 *
 * Full Browser Use action registry and execution engine:
 *   - Navigation: navigate, go_back, go_forward, refresh, switch_tab, close_tab
 *   - Interaction: click_element, click_coordinate, double_click, right_click, hover, input_text, send_keys, select_dropdown_option
 *   - Scrolling: scroll_page (smooth), scroll_to_text
 *   - Extraction: extract (query, schema, links, images)
 *   - Flow: wait, done
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
          description: 'Ask the user a structured question or request confirmation using an interactive widget.',
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
