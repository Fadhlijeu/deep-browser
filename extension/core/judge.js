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
     * @returns {string}
     */
    formatStepsForJudge(history = []) {
      if (!Array.isArray(history) || history.length === 0) {
        return '(No prior steps recorded)';
      }

      return history.map((item, idx) => {
        const stepNum = item.step != null ? item.step : idx + 1;
        const actName = item.action?.name || item.action?.action_name || 'unknown';
        const params = JSON.stringify(item.action?.parameters || {});
        const status = item.result?.success ? 'Success' : `Failed (${item.result?.error || 'error'})`;
        const thinkingSnippet = item.thinking ? ` | Thinking: ${String(item.thinking).slice(0, 140)}` : '';
        return `[Step ${stepNum}] Action: ${actName} ${params} -> ${status}${thinkingSnippet}`;
      }).join('\n');
    }

    /**
     * Constructs the evaluation prompt for the judge LLM.
     * @param {Object} params
     * @param {string} params.task
     * @param {string} params.finalResult
     * @param {Array<Object>} [params.history]
     * @param {string} [params.groundTruth]
     * @returns {string}
     */
    constructJudgePrompt({ task, finalResult, history = [], groundTruth = null }) {
      const stepsText = this.formatStepsForJudge(history);

      let groundTruthSection = '';
      if (groundTruth) {
        groundTruthSection = `### 🎯 GROUND TRUTH VALIDATION CRITERIA (HIGHEST PRIORITY):
${groundTruth}
The agent MUST satisfy these explicit criteria to receive a verdict: true.
`;
      }

      return `You are an impartial Judge evaluating the execution trace of an autonomous web browsing agent.
Your mission is to evaluate whether the agent genuinely and completely accomplished the user's task.

### 📋 ORIGINAL USER GOAL:
${task}

${groundTruthSection}### 📜 AGENT EXECUTION TRACE (STEPS PERFORMED):
${stepsText}

### 🏁 FINAL RESULT RETURNED TO USER:
${finalResult || '(No final response returned)'}

### EVALUATION CRITERIA:
1. Did the agent execute the necessary actions to fulfill the user's intent?
2. Is the final result accurate and supported by evidence, or did the agent hallucinate/stop prematurely?
3. Did the agent encounter a blocking captcha or cloudflare check?
4. Was the requested task impossible or invalid?

Respond STRICTLY with a single valid JSON object in this format:
\`\`\`json
{
  "verdict": true,
  "reasoning": "Clear 2-3 sentence explanation justifying your decision.",
  "failure_reason": null,
  "impossible_task": false,
  "reached_captcha": false
}
\`\`\`
If verdict is false, provide a concise explanation in "failure_reason".`;
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
     * @returns {Promise<{verdict: boolean, reasoning: string, failure_reason: string|null, impossible_task: boolean, reached_captcha: boolean}>}
     */
    async evaluateTrace({ task, finalResult, history = [], screenshotBase64 = null, groundTruth = null, llmClient = null }) {
      const client = llmClient || this.llmClient;
      if (!client) {
        throw new Error('Judge requires an active LLMClient to evaluate traces.');
      }

      const prompt = this.constructJudgePrompt({ task, finalResult, history, groundTruth });
      const systemPrompt = 'You are an objective AI Judge evaluating web agent traces. Respond strictly in valid JSON.';

      let rawResponse = '';
      try {
        const stepPayload = {
          textPrompt: prompt,
          screenshotBase64,
        };
        const decision = await client.planNextStep(systemPrompt, stepPayload);

        // If decision was parsed into thinking/parameters
        if (decision.parameters && typeof decision.parameters.verdict === 'boolean') {
          return {
            verdict: decision.parameters.verdict,
            reasoning: decision.parameters.reasoning || decision.thinking || '',
            failure_reason: decision.parameters.failure_reason || null,
            impossible_task: !!decision.parameters.impossible_task,
            reached_captcha: !!decision.parameters.reached_captcha,
          };
        }

        // Check if decision has verdict directly
        if (typeof decision.verdict === 'boolean') {
          return {
            verdict: decision.verdict,
            reasoning: decision.reasoning || decision.thinking || '',
            failure_reason: decision.failure_reason || null,
            impossible_task: !!decision.impossible_task,
            reached_captcha: !!decision.reached_captcha,
          };
        }

        // Fallback: heuristic extraction from thinking or text
        const isTrue = /"verdict"\s*:\s*true/i.test(JSON.stringify(decision));
        return {
          verdict: isTrue,
          reasoning: decision.thinking || 'Evaluated trace outcome',
          failure_reason: isTrue ? null : (decision.thinking || 'Task incomplete'),
          impossible_task: false,
          reached_captcha: false,
        };
      } catch (err) {
        return {
          verdict: false,
          reasoning: `Judge evaluation failed due to error: ${err.message}`,
          failure_reason: err.message,
          impossible_task: false,
          reached_captcha: false,
        };
      }
    }
  }

  global.Judge = Judge;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
