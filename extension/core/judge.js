/**
 * Deep Browser Extension — Independent Trace Judge System
 * =======================================================
 *
 * Implements the Judge evaluation architecture from upstream browser-use legacy:
 * Evaluates whether an agent's execution trace, final answer, and evidence genuinely
 * satisfied the user's objective without hallucination or superficial completion.
 */

(function(global) {
  'use strict';

  class Judge {
    /**
     * @param {Object} [options]
     * @param {LLMClient} [options.llmClient] - Dedicated judge LLM (or uses agent LLM)
     */
    constructor(options = {}) {
      this.llmClient = options.llmClient || null;
    }

    /**
     * Formats agent history steps into readable lines for the judge.
     * @param {Array<Object>} history
     * @returns {Array<string>}
     */
    formatStepsForJudge(history = []) {
      if (!Array.isArray(history) || history.length === 0) {
        return ['(No prior steps recorded)'];
      }

      return history.map((item, idx) => {
        const stepNum = item.step != null ? item.step : idx + 1;
        const actName = item.action?.name || item.action?.action_name || 'unknown';
        const params = JSON.stringify(item.action?.parameters || {});
        const status = item.result?.success ? 'Success' : `Failed (${item.result?.error || 'error'})`;
        const dataSnippet = item.result?.data ? ` | Data: ${JSON.stringify(item.result.data).slice(0, 160)}` : (item.result?.message ? ` | Msg: ${item.result.message}` : '');
        const thinkingSnippet = item.thinking ? ` | Thinking: ${String(item.thinking).slice(0, 160)}` : '';
        return `[Step ${stepNum}] Action: ${actName} ${params} -> ${status}${dataSnippet}${thinkingSnippet}`;
      });
    }

    /**
     * Constructs the evaluation prompt for the judge LLM.
     * @param {Object} params
     * @param {string} params.task
     * @param {string} params.finalResult
     * @param {Array<Object>|Array<string>} [params.history]
     * @param {string} [params.groundTruth]
     * @returns {string}
     */
    constructJudgePrompt({ task, finalResult, history = [], groundTruth = null }) {
      const stepsList = Array.isArray(history)
        ? (history.length > 0 && typeof history[0] === 'string' ? history : this.formatStepsForJudge(history))
        : ['(No steps provided)'];
      const stepsText = stepsList.join('\n');

      let groundTruthSection = '';
      if (groundTruth) {
        groundTruthSection = `### 🎯 GROUND TRUTH VALIDATION CRITERIA (HIGHEST PRIORITY):
${groundTruth}
The agent MUST satisfy these explicit criteria to receive a verdict: true.
`;
      }

      return `You are an impartial Judge evaluating the execution trace of an autonomous web browsing agent.
Your mission is to evaluate whether the agent genuinely accomplished the user's objective based on the execution trace and final answer returned.

### 📋 ORIGINAL USER GOAL:
${task}

${groundTruthSection}### 📜 AGENT EXECUTION TRACE (STEPS PERFORMED):
${stepsText}

### 🏁 FINAL RESULT RETURNED TO USER:
${finalResult || '(No final response returned)'}

### EVALUATION PRINCIPLES & GUIDELINES:
1. **Core Objective Fulfillment (First Priority)**:
   - Evaluate whether the agent delivered what the user asked for.
   - For queries like "buka [Portal X] lalu cari [Entitas Y] dan ambil informasinya":
     - Did the agent identify or navigate to the target website/portal X?
     - Did it perform the search for entity Y?
     - Did it inspect the entity's profile or detail record and present the information in the final result?
     - If the agent successfully located the profile and returned the requested information (biodata, academic history, attributes, status, etc.) in the final result, the task is **SUCCESSFUL (verdict: true)**.
2. **Viewport vs. Live DOM Reality**:
   - The screenshot only shows the current viewport at the instant of completion. The agent inspects the entire interactive DOM across multiple steps.
   - If the agent extracted data from the webpage and provided it accurately in the final result, that data represents verified DOM evidence. Do NOT claim the task failed simply because the final screenshot is at the bottom or top of the page.
3. **Trajectory & Navigation Tolerance**:
   - Normal web exploration (e.g. navigating via search engine to find the official portal, clicking into search results, or scrolling to reveal content) is valid autonomous agent behavior. Do not penalize realistic browsing steps if the end result was successfully obtained.
4. **Failure Conditions (verdict: false)**:
   - ONLY mark verdict: false if:
     a) The agent halted prematurely without ever navigating to the destination or finding the entity.
     b) The final result is completely empty, fabricated, or says "Task completed" with none of the requested information.
     c) A blocking captcha or Cloudflare challenge prevented access.
     d) The target website was genuinely down or returned a 404/500 error and no alternative was available.
5. **Verdict & Failure Reason Rules**:
   - If verdict is true: "failure_reason" MUST be null.
   - If verdict is false: "failure_reason" must be a concise, objective explanation of what required information was missing.

Respond STRICTLY with a single valid JSON object in this format (no markdown code fence outside the JSON):
\`\`\`json
{
  "verdict": true,
  "reasoning": "Clear 2-3 sentence explanation justifying your evaluation based on the trace and final result.",
  "failure_reason": null,
  "impossible_task": false,
  "reached_captcha": false
}
\`\`\``;
    }

    /**
     * Evaluates the agent trace and returns a structured JudgementResult.
     * @param {Object} params
     * @param {string} params.task
     * @param {string} params.finalResult
     * @param {Array<Object>} [params.history]
     * @param {string} [params.screenshotBase64]
     * @param {string} [params.groundTruth]
     * @param {LLMClient} [params.llmClient] - Overriding LLM client
     * @returns {Promise<{verdict: boolean, reasoning: string, failure_reason: string|null, impossible_task: boolean, reached_captcha: boolean, formattedSteps: Array<string>}>}
     */
    async evaluateTrace({ task, finalResult, history = [], screenshotBase64 = null, groundTruth = null, llmClient = null }) {
      const client = llmClient || this.llmClient;
      if (!client) {
        throw new Error('Judge requires an active LLMClient to evaluate traces.');
      }

      const formattedSteps = this.formatStepsForJudge(history);
      const prompt = this.constructJudgePrompt({ task, finalResult, history: formattedSteps, groundTruth });
      const systemPrompt = 'You are an objective AI Judge evaluating autonomous web agent traces. Respond strictly with valid JSON.';

      try {
        const stepPayload = {
          textPrompt: prompt,
          screenshotBase64,
        };
        const decision = await client.planNextStep(systemPrompt, stepPayload);

        let evalResult;
        const paramsObj = decision.parameters || {};

        // 1. Direct boolean verdict from decision or parameters
        if (typeof decision.verdict === 'boolean') {
          evalResult = {
            verdict: decision.verdict,
            reasoning: decision.reasoning || decision.thinking || '',
            failure_reason: decision.verdict ? null : (decision.failure_reason || null),
            impossible_task: !!decision.impossible_task,
            reached_captcha: !!decision.reached_captcha,
          };
        } else if (typeof paramsObj.verdict === 'boolean') {
          evalResult = {
            verdict: paramsObj.verdict,
            reasoning: paramsObj.reasoning || decision.thinking || '',
            failure_reason: paramsObj.verdict ? null : (paramsObj.failure_reason || null),
            impossible_task: !!paramsObj.impossible_task,
            reached_captcha: !!paramsObj.reached_captcha,
          };
        } else {
          // 2. Fallback heuristic extraction from raw decision string or thinking
          const rawStr = JSON.stringify(decision) + ' ' + (decision.thinking || '') + ' ' + (paramsObj.text || '');
          const isTrue = /"verdict"\s*:\s*true/i.test(rawStr) || /\bverdict\b[\s:]+\b(?:true|valid|pass|berhasil)\b/i.test(rawStr);
          const failureReasonMatch = rawStr.match(/"failure_reason"\s*:\s*"((?:\\.|[^"\\])*)"/i);
          const failureReason = isTrue ? null : (failureReasonMatch ? failureReasonMatch[1] : (decision.thinking || 'Task incomplete'));

          evalResult = {
            verdict: isTrue,
            reasoning: decision.thinking || (isTrue ? 'Agent completed the task as requested.' : 'Task execution did not satisfy requirements.'),
            failure_reason: failureReason,
            impossible_task: /"impossible_task"\s*:\s*true/i.test(rawStr),
            reached_captcha: /"reached_captcha"\s*:\s*true/i.test(rawStr),
          };
        }

        // Enforce failure_reason invariant: null when verdict is true
        if (evalResult.verdict === true) {
          evalResult.failure_reason = null;
        }

        return {
          ...evalResult,
          formattedSteps,
          task,
          finalResult,
          groundTruth,
        };
      } catch (err) {
        return {
          verdict: false,
          reasoning: `Judge evaluation failed due to error: ${err.message}`,
          failure_reason: err.message,
          impossible_task: false,
          reached_captcha: false,
          formattedSteps,
          task,
          finalResult,
          groundTruth,
        };
      }
    }
  }

  global.Judge = Judge;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
