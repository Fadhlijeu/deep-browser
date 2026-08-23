/**
 * Deep Browser Extension — Browser Use Tools & Action Registry
 * =============================================================
 *
 * Defines the standard Browser Use action schemas and execution handlers.
 * Translates LLM action calls into atomic operations on BrowserSession.
 */

(function(global) {
  'use strict';

  class ActionResult {
    constructor(success, data = null, error = null) {
      this.success = Boolean(success);
      this.data = data;
      this.error = error;
    }
  }

  class Tools {
    /**
     * @param {BrowserSession} browserSession
     */
    constructor(browserSession) {
      this.browserSession = browserSession;
    }

    /**
     * Returns JSON schema / descriptions of available tools for prompt building.
     */
    static getActionSchemas() {
      return [
        {
          name: 'click_element',
          description: 'Click an interactive element on the page using its 1-based index [1], [2], etc.',
          parameters: {
            index: { type: 'number', required: true, description: 'The 1-based index of the element to click.' },
            xpath: { type: 'string', required: false, description: 'Optional explicit XPath of the element.' },
          },
        },
        {
          name: 'input_text',
          description: 'Type text into an input field, search box, or textarea identified by its index.',
          parameters: {
            index: { type: 'number', required: true, description: 'The index of the input element.' },
            text: { type: 'string', required: true, description: 'The text string to type.' },
            clear: { type: 'boolean', required: false, description: 'Whether to clear existing text first (default true).' },
          },
        },
        {
          name: 'navigate',
          description: 'Navigate to a specific URL in the current tab or open in a new tab.',
          parameters: {
            url: { type: 'string', required: true, description: 'The web URL to navigate to.' },
            new_tab: { type: 'boolean', required: false, description: 'Open in a new tab if true.' },
          },
        },
        {
          name: 'scroll_page',
          description: 'Scroll the webpage up or down.',
          parameters: {
            direction: { type: 'string', enum: ['down', 'up'], description: 'Direction to scroll (default down).' },
            amount: { type: 'number', description: 'Pixels to scroll (default 450).' },
          },
        },
        {
          name: 'scroll_to_text',
          description: 'Scroll down/up to bring an element with specific visible text into view.',
          parameters: {
            text: { type: 'string', required: true, description: 'The text snippet to locate.' },
          },
        },
        {
          name: 'send_keys',
          description: 'Send special keyboard keys such as Enter, Escape, Backspace, or ArrowDown to active element.',
          parameters: {
            keys: { type: 'string', required: true, description: 'Key name, e.g. "Enter", "Tab", "Escape".' },
          },
        },
        {
          name: 'wait',
          description: 'Wait for a specified number of seconds for page rendering, animations, or async requests.',
          parameters: {
            seconds: { type: 'number', required: false, description: 'Seconds to wait (1-10s, default 3).' },
          },
        },
        {
          name: 'go_back',
          description: 'Navigate back to the previous page in history.',
          parameters: {},
        },
        {
          name: 'go_forward',
          description: 'Navigate forward in history.',
          parameters: {},
        },
        {
          name: 'refresh',
          description: 'Refresh the current webpage.',
          parameters: {},
        },
        {
          name: 'switch_tab',
          description: 'Switch focus to another open tab by tab ID.',
          parameters: {
            tab_id: { type: 'number', required: true, description: 'The tab ID to switch to.' },
          },
        },
        {
          name: 'done',
          description: 'Declare the user task as complete and provide the final answer or summary.',
          parameters: {
            text: { type: 'string', required: true, description: 'The complete answer, summary, or result of the task.' },
            success: { type: 'boolean', required: false, description: 'Whether the goal was successfully achieved.' },
          },
        },
      ];
    }

    /**
     * Executes an action object by name.
     * @param {string} actionName
     * @param {Object} params
     * @returns {Promise<ActionResult>}
     */
    async execute(actionName, params = {}) {
      const name = String(actionName || '').trim();

      try {
        switch (name) {
          case 'click_element': {
            const index = Number(params.index);
            if (!index || isNaN(index)) {
              return new ActionResult(false, null, 'click_element requires a numeric index');
            }
            const res = await this.browserSession.click(index, params.xpath);
            if (!res.success) return new ActionResult(false, null, res.error);
            return new ActionResult(true, res);
          }

          case 'input_text': {
            const index = Number(params.index);
            if (!index || isNaN(index)) {
              return new ActionResult(false, null, 'input_text requires a numeric index');
            }
            const text = String(params.text ?? '');
            const clear = params.clear !== false;
            const res = await this.browserSession.typeText(index, text, clear, params.xpath);
            if (!res.success) return new ActionResult(false, null, res.error);
            return new ActionResult(true, res);
          }

          case 'navigate': {
            const url = String(params.url || '').trim();
            if (!url) return new ActionResult(false, null, 'navigate requires a url');
            const res = await this.browserSession.navigate(url, Boolean(params.new_tab));
            return new ActionResult(true, res);
          }

          case 'scroll_page': {
            const dir = params.direction === 'up' ? 'up' : 'down';
            const amt = Number(params.amount) || 450;
            const res = await this.browserSession.scroll(dir, amt);
            return new ActionResult(true, res);
          }

          case 'scroll_to_text': {
            const text = String(params.text || '').trim();
            if (!text) return new ActionResult(false, null, 'scroll_to_text requires text');
            const res = await this.browserSession.scrollToText(text);
            if (!res.success) return new ActionResult(false, null, res.error);
            return new ActionResult(true, res);
          }

          case 'send_keys': {
            const keys = String(params.keys || 'Enter');
            const res = await this.browserSession.sendKeys(keys);
            return new ActionResult(true, res);
          }

          case 'wait': {
            const sec = Math.max(1, Math.min(10, Number(params.seconds) || 3));
            await new Promise(r => setTimeout(r, sec * 1000));
            return new ActionResult(true, { waited: sec });
          }

          case 'go_back': {
            const res = await this.browserSession.goBack();
            return new ActionResult(true, res);
          }

          case 'go_forward': {
            const res = await this.browserSession.goForward();
            return new ActionResult(true, res);
          }

          case 'refresh': {
            const res = await this.browserSession.refresh();
            return new ActionResult(true, res);
          }

          case 'switch_tab': {
            const tabId = Number(params.tab_id);
            const res = await this.browserSession.switchTab(tabId);
            return new ActionResult(true, res);
          }

          case 'done': {
            return new ActionResult(true, {
              is_done: true,
              text: String(params.text || 'Task completed'),
              success: params.success !== false,
            });
          }

          default:
            return new ActionResult(false, null, `Unknown action: "${name}"`);
        }
      } catch (err) {
        return new ActionResult(false, null, err.message || String(err));
      }
    }
  }

  global.ActionResult = ActionResult;
  global.Tools = Tools;
})(typeof window !== 'undefined' ? window : this);
