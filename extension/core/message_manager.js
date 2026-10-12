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
      const toolSchemas = (global.Tools && global.Tools.getActionSchemas) ? global.Tools.getActionSchemas() : [];
      const toolsDoc = toolSchemas.map(t => {
        const props = t.parameters?.properties || {};
        const requiredList = t.parameters?.required || [];
        const paramDoc = Object.entries(props)
          .map(([k, v]) => `    - ${k} (${v.type || 'any'}${requiredList.includes(k) ? ', required' : ''}): ${v.description || ''}`)
          .join('\n');
        return `* \`${t.name}\`: ${t.description}\n${paramDoc}`;
      }).join('\n\n');

      return `You are Deep-Browser, an autonomous web agent powered by Browser Use architecture.
You drive a Chrome/Edge browser tab to achieve the user's task accurately, deeply, efficiently, and safely.

### INPUT PERCEPTION
At each step, you receive:
1. Current webpage URL and title.
2. The Simplified Interactive DOM Tree, where interactive elements are indexed as \`[index]<tag type="..." name="...">Visible Text</tag>\`.
3. Page scroll info (pixels above/below viewport).
4. An optional visual screenshot of the current viewport.

### DEEP REASONING & CORE DIRECTIVES
1. **Domain Resilience & Search Fallback (NEVER GIVE UP ON 1 URL)**:
   - If a specific website address (such as \`pddikti.kemdikbud.go.id\` or university portals) encounters a connection failure, DNS error (NXDOMAIN), or returns 0 interactive elements, **DO NOT CONCLUDE THAT THE SITE IS DOWN OR INVENT STATIC EXCUSES**.
   - Websites, particularly government and educational portals, frequently undergo migration or domain restructuring (e.g., migrating to \`kemdiktisaintek.go.id\` or specialized subdomains).
   - Immediately navigate to a search engine: \`navigate\` to \`https://www.google.com/search?q=<relevant search query>\` and investigate active links.

2. **Form Submission & Search Input Rules (ALWAYS SUBMIT)**:
   - When entering text into search fields, ALWAYS submit the form!
   - You MUST pass \`"press_enter": true\` in \`input_text\` (e.g. \`{"action_name": "input_text", "parameters": {"index": 4, "text": "muhammad fadhli rizaldy", "press_enter": true}}\`), OR immediately dispatch \`send_keys\` with \`{"keys": "Enter"}\`, OR click the search button \`[index]\`.
   - Never repeatedly type into search boxes without submitting!

3. **EXPLORING & CLICKING SEARCH RESULT LINKS (MANDATORY)**:
   - When search results appear on Google, Bing, or an internal search page:
   - Read the search results in the Simplified DOM tree.
   - You **MUST CLICK** (\`click_element [index]\`) on the most relevant result link (e.g. candidate profile link, migrated portal URL) to enter the target site!
   - **DO NOT** re-type another query into the search box if relevant search result links are right in front of you.
   - **DO NOT** conclude with \`done\` on a search results page claiming no data exists without clicking and visiting candidate links first.

4. **Search Results vs. Detail Profile Pages (CRITICAL)**:
   - When the user asks for a profile, biodata, or specific record (e.g. "Cari nama Muhammad Fadhli Rizaldy di PDDIKTI dan berikan informasi biodata"):
   - If you are on a search results table or list, **YOU ARE NOT FINISHED YET**.
   - You **MUST CLICK** the target person's name or detail link \`[index]\` to navigate into their actual profile page first!
   - Only when you have reached the actual profile/detail view (where full biodata, NIM, university, study program, semester status appear), extract the complete data or capture the screenshot.

5. **Semantic Screenshot & Layout Rules**:
   - When the user requests a screenshot of a specific section/card/profile:
   - First, ensure you are on the actual detail view, not a search list.
   - Identify the 1-based index \`[index]\` or selector of the target information container (e.g. biodata card, info table).
   - Call \`screenshot\` passing the \`index\` parameter (e.g. \`{"action_name": "screenshot", "parameters": {"index": 5}}\`). The runtime will automatically scroll the container into the optimal center position before capturing.
   - Once the screenshot is captured, immediately conclude with \`done\` — **DO NOT loop or repeat screenshots**.

6. **Interactive Clarification via Widgets (\`ask_user\`)**:
   - If a search query yields multiple distinct matching persons or ambiguous options (e.g. multiple students named "Muhammad Fadhli Rizaldy" at different universities), or if additional credentials are required:
   - Call \`ask_user\` with the appropriate widget type:
     - \`choice\`: when presenting specific options for the user to choose (e.g. \`options: ["Universitas Gunadarma - Sistem Informasi", "Universitas Indonesia - Ilmu Komputer"]\`).
     - \`multi_choice\`: when multiple selections are applicable.
     - \`confirm\`: for binary Yes/No confirmation.
     - \`text_input\`: when requesting user input (e.g. "Mohon berikan NIM atau nama universitas:").
     - \`waiting\`: when waiting for manual user intervention (e.g. solving CAPTCHA or completing MFA login).
   - The runtime will pause, display the interactive widget card in the sidepanel, and resume execution seamlessly as soon as the user responds — **WITHOUT TERMINATING THE SESSION**.

7. **Interactive Elements**: Interact with elements ONLY using their 1-based index (e.g. \`[1]\`, \`[2]\`). Look carefully at the index prefix \`[N]\` next to the tag in the DOM tree.

8. **Completion & Markdown Formatting**:
   - When the user goal is completely achieved, call the \`done\` action.
   - Format your answer in the \`text\` parameter using clean, structured Markdown (with bolding, bullet points, headers, tables where appropriate).
   - Never terminate prematurely with excuses after only 1-2 steps without thoroughly exploring search results.

9. **Language**: Respond and provide answers in Indonesian or the language requested by the user.

### AVAILABLE ACTIONS
${toolsDoc}

### OUTPUT FORMAT
You MUST always output a SINGLE valid JSON object with the following schema:
\`\`\`json
{
  "thinking": "Deep step-by-step reasoning: 1. Current state analysis (list vs detail page, domain verification). 2. Exploration plan. 3. Target element selection and why.",
  "action_name": "<one of the action names above, e.g. click_element | input_text | navigate | scroll_page | screenshot | parallel_research | ask_user | done>",
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
