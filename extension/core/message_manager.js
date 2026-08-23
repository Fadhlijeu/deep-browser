/**
 * Deep Browser Extension — Browser Use MessageManager & Prompt Builder
 * ====================================================================
 *
 * Formats the Browser Use system prompt, interactive DOM state representations,
 * step history, and manages the context window for LLM requests.
 */

(function(global) {
  'use strict';

  class MessageManager {
    /**
     * @param {Object} options
     * @param {string} options.task
     * @param {number} [options.maxHistorySteps=15]
     */
    constructor(options = {}) {
      this.task = options.task || '';
      this.maxHistorySteps = options.maxHistorySteps || 15;
      this.history = []; // Array of { step, observation, thinking, action, result }
    }

    /**
     * Returns the Browser Use system prompt.
     */
    getSystemPrompt() {
      const toolSchemas = global.Tools.getActionSchemas();
      const toolsDoc = toolSchemas.map(t => {
        const paramDoc = Object.entries(t.parameters)
          .map(([k, v]) => `    - ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description || ''}`)
          .join('\n');
        return `* \`${t.name}\`: ${t.description}\n${paramDoc}`;
      }).join('\n\n');

      return `You are Deep-Browser, an autonomous web agent powered by Browser Use architecture.
You drive a Chrome browser tab to achieve the user's task accurately, efficiently, and safely.

### INPUT PERCEPTION
At each step, you receive:
1. Current webpage URL and title.
2. The Simplified Interactive DOM Tree, where interactive elements are indexed as \`[index]<tag type="..." name="...">Visible Text</tag>\`.
3. Page scroll info (pixels above/below viewport).
4. An optional visual screenshot of the current viewport.

### CORE DIRECTIVES
1. **Interactive Elements**: Interact with elements ONLY using their 1-based index (e.g. \`[1]\`, \`[2]\`). Look carefully at the index prefix \`[N]\` next to the tag in the DOM tree.
2. **Form Inputs & Searches**: To search or fill inputs, use \`input_text\` with the target index and text. You can follow with \`send_keys\` (e.g. \`{"keys": "Enter"}\`) or click the search/submit button.
3. **Interactive User Prompts & Widgets**: Whenever the user asks you to ask them a question, ask for clarification, request choice selection, or when you need user preference/confirmation before proceeding, YOU MUST CALL the \`ask_user\` action with \`{"type": "choice"|"confirm"|"text_input", "question": "...", "options": [...]}\`. NEVER answer with plain text in \`done\` if the user wants you to ask them!
4. **Screenshots & Visuals**: When the user requests a screenshot or visual capture (e.g. "screenshot informasinya", "screenshot lagi"), call \`screenshot\` (pass optional \`index\` or \`selector\` to automatically scroll the target element into view). After taking the screenshot, you MUST immediately call \`done\` in the next step to complete the task — DO NOT call screenshot in an infinite loop!
5. **PDF & Document Export**: When the user asks to save/export the page as PDF, call \`save_as_pdf\` and conclude with \`done\`.
6. **Structured Visual Snippets**: When extracting specific card/table/biodata information on a webpage, use \`extract_html_snippet\` with the selector or keywords so the visual structured card is displayed in chat.
7. **Scrolling & Navigation**: If the element or information is not visible yet, use \`scroll_page\` or \`navigate\`.
8. **Completion**: When the goal is completed, call the \`done\` action with a clear, complete, and formatted answer in the \`text\` parameter.
9. **Language**: Respond and provide answers in Indonesian or the language requested by the user.

### AVAILABLE ACTIONS
${toolsDoc}

### OUTPUT FORMAT
You MUST always output a SINGLE valid JSON object with the following schema:
\`\`\`json
{
  "thinking": "Brief step-by-step reasoning about the current page state, what you see, and why you are choosing this action.",
  "action_name": "<one of the action names above, e.g. click_element | input_text | navigate | scroll_page | send_keys | done>",
  "parameters": {
    "<param_name>": "<param_value>"
  }
}
\`\`\`
Do NOT wrap with markdown other than \`\`\`json or raw JSON. Output valid JSON only.`;
    }

    /**
     * Builds the prompt payload for the current step.
     * @param {Object} state - The DOM and browser state from BrowserSession.getState()
     * @param {number} stepNumber - Current 1-based step counter
     * @returns {Object} { textPrompt, screenshotBase64, fullHistory }
     */
    /**
     * Builds the prompt payload for the current step.
     * @param {Object} state - The DOM and browser state from BrowserSession.getState()
     * @param {number} stepNumber - Current 1-based step counter
     * @returns {Object} { textPrompt, screenshotBase64, fullHistory }
     */
    buildStepPrompt(state, stepNumber = 1) {
      const historySection = this.formatHistory();

      // Check if the immediately preceding step had a user response from a widget
      let latestUserResponseSection = '';
      if (this.history.length > 0) {
        const lastStep = this.history[this.history.length - 1];
        if (lastStep.result?.user_response != null) {
          const respStr = typeof lastStep.result.user_response === 'object'
            ? JSON.stringify(lastStep.result.user_response)
            : String(lastStep.result.user_response);
          latestUserResponseSection = `### ⚠️ CRITICAL NEW USER INPUT (FROM INTERACTIVE WIDGET):
The user just provided this response to your question:
"${respStr}"
YOU MUST IMMEDIATELY ACT ON THIS NEW USER INPUT. Do not repeat previous searches or ignore this value!
`;
        }
      }

      const stateSection = `### CURRENT BROWSER STATE (Step ${stepNumber})
* URL: ${state.url || 'about:blank'}
* Title: ${state.title || 'Untitled'}
* Viewport: ${state.pageInfo?.viewport_width || 1280}x${state.pageInfo?.viewport_height || 800} (Scroll Y: ${state.pageInfo?.scroll_y || 0})
* Pixels Above: ${state.pageInfo?.pixels_above || 0}px | Pixels Below: ${state.pageInfo?.pixels_below || 0}px

### SIMPLIFIED INTERACTIVE DOM TREE
${state.simplifiedTreeText ? state.simplifiedTreeText : '(No interactive elements detected on this view)'}
`;

      const userGoalSection = `### ORIGINAL USER GOAL
${this.task}

Analyze the current page state above and decide the next best action to accomplish the goal. Format your final answer in clean structured Markdown when calling done. Return your JSON response.`;

      const textPrompt = [historySection, latestUserResponseSection, stateSection, userGoalSection]
        .filter(Boolean)
        .join('\n\n');

      return {
        textPrompt,
        screenshotBase64: state.screenshot || null,
        url: state.url,
        title: state.title,
      };
    }

    /**
     * Formats previous steps into history text.
     */
    formatHistory() {
      if (this.history.length === 0) return '';

      const recent = this.history.slice(-this.maxHistorySteps);
      const lines = ['### PREVIOUS STEPS HISTORY:'];

      recent.forEach(h => {
        const actionStr = JSON.stringify(h.action?.parameters || {});
        const statusStr = h.result?.success ? 'Success' : `Failed (${h.result?.error || 'error'})`;
        lines.push(
          `[Step ${h.step}] Action: \`${h.action?.name || 'unknown'}\` ${actionStr} → Result: ${statusStr}`
        );
        if (h.result?.user_response != null) {
          lines.push(`  ↳ USER INTERACTIVE RESPONSE: ${JSON.stringify(h.result.user_response)}`);
        }
        if (h.thinking) {
          lines.push(`  Thinking: ${h.thinking.slice(0, 160)}`);
        }
      });

      return lines.join('\n');
    }

    /**
     * Records a completed step into history.
     */
    recordStep(step, thinking, action, result) {
      this.history.push({
        step,
        thinking: String(thinking || ''),
        action: action || {},
        result: result || {},
        timestamp: Date.now(),
      });
    }
  }

  global.MessageManager = MessageManager;
})(typeof window !== 'undefined' ? window : this);
