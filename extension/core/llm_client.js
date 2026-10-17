/**
 * Deep Browser Extension — Direct HTTP LLM Client
 * ===============================================
 *
 * Makes direct HTTP fetch requests to AI providers from the Chrome Extension runtime:
 *   - Google Gemini (Gemini 2.0 Flash, 1.5 Pro, Flash Lite)
 *   - OpenAI (GPT-4o, GPT-4o-mini)
 *   - Anthropic Claude (Claude 3.5 Sonnet)
 *   - Ollama (Local 100% offline models)
 *
 * Robustly parses action JSON objects and handles vision / screenshot payloads.
 */

(function(global) {
  'use strict';

  class LLMClient {
    /**
     * @param {Object} config
     * @param {string} [config.provider='gemini'] - 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'custom_openai'
     * @param {string} [config.model='gemini-2.0-flash']
     * @param {string} [config.apiKey='']
     * @param {string} [config.baseUrl='']
     * @param {string} [config.ollamaHost='http://localhost:11434']
     * @param {number} [config.temperature=0.1]
     */
    constructor(config = {}) {
      this.provider = config.provider || 'gemini';
      this.model = config.model || 'gemini-3.5-flash-lite';
      this.apiKey = config.apiKey || '';
      this.baseUrl = config.baseUrl || '';
      this.ollamaHost = config.ollamaHost || 'http://localhost:11434';
      this.temperature = config.temperature ?? 0.1;
      this.currentAbortController = null;

      // Priority 3: Fallback LLM support
      this.fallbackClient = config.fallbackClient || null;
      this.isUsingFallback = false;
    }

    /**
     * Aborts any currently active HTTP fetch request immediately.
     */
    abort() {
      if (this.currentAbortController) {
        try {
          this.currentAbortController.abort();
        } catch (_) {}
        this.currentAbortController = null;
      }
    }

    /**
     * Sends context and current state to the LLM and receives structured action decision.
     * @param {string} systemPrompt
     * @param {Object} stepPayload - { textPrompt, screenshotBase64 }
     * @returns {Promise<Object>} { thinking, action_name, parameters }
     */
    async planNextStep(systemPrompt, stepPayload) {
      try {
        return await this._executePlanStep(systemPrompt, stepPayload);
      } catch (err) {
        if (this.fallbackClient && !this.isUsingFallback && err.name !== 'AbortError') {
          console.warn(`[LLMClient] Primary LLM failed (${err.message}), switching to fallback LLM...`);
          this.isUsingFallback = true;
          return await this.fallbackClient.planNextStep(systemPrompt, stepPayload);
        }
        throw err;
      }
    }

    async _executePlanStep(systemPrompt, stepPayload) {
      const { textPrompt, screenshotBase64 } = stepPayload;

      let rawResponseText = '';

      switch (this.provider) {
        case 'gemini':
          rawResponseText = await this._callGemini(systemPrompt, textPrompt, screenshotBase64);
          break;
        case 'openai':
        case 'custom_openai':
          rawResponseText = await this._callOpenAI(systemPrompt, textPrompt, screenshotBase64);
          break;
        case 'anthropic':
          rawResponseText = await this._callAnthropic(systemPrompt, textPrompt, screenshotBase64);
          break;
        case 'ollama':
          rawResponseText = await this._callOllama(systemPrompt, textPrompt, screenshotBase64);
          break;
        default:
          rawResponseText = await this._callOpenAI(systemPrompt, textPrompt, screenshotBase64);
          break;
      }

      return this._parseActionJSON(rawResponseText);
    }

    /**
     * Multimodal Vision Evaluation Loop:
     * Evaluates whether a captured screenshot satisfies the user's specific context & goal,
     * or if it is just a commercial landing page, blank page, search list, or cookie banner.
     * @param {Object} params
     * @param {string} params.imageBase64 - Clean base64 PNG/JPEG string
     * @param {string} params.userGoal - The original user prompt / task
     * @param {string} params.currentUrl - The URL from which the screenshot was taken
     * @returns {Promise<Object>} { valid: boolean, reason: string, issue: string, suggested_action: string }
     */
    async evaluateScreenshotWithVision({ imageBase64, userGoal, currentUrl }) {
      if (!imageBase64 || (!this.apiKey && this.provider !== 'ollama')) {
        return { valid: true, reason: 'Evaluasi visual dilewati (mode fallback)', issue: 'none' };
      }

      // Strip data URI prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const evalSystemPrompt = `You are an expert Multimodal Visual Evaluator for an autonomous web browsing agent.
Your mission is to evaluate a captured screenshot against the user's explicit goal.

RULES FOR EVALUATION:
1. CONTENT QUALITY & COMPLETENESS:
   - Does this image show the true substantive content requested (specific article, record, repository, profile, or detail view)?
   - Or is this just a generic corporate homepage, marketing landing page, login screen, or cookie popup? If it is a generic landing page or cookie popup, IT IS INVALID (valid: false)!
2. SEARCH LIST VS DETAIL VIEW:
   - If the user requested a specific profile, entity biodata, product detail, or article:
   - Is this an actual detail view?
   - Or is this merely a search results list or table with candidate links? If it is just a search results list, IT IS INVALID (valid: false)!
3. VISUAL TRUNCATION & SCROLL COMPLETION:
   - Is essential requested text or table data noticeably cut off, sliced in half at the bottom border, or truncated where scrolling down is required to view it in full? If critical text is cut off, IT IS INVALID (valid: false) with issue: "truncated_content".
4. INTERACTIVE STATE (SLIDERS, DRAWERS, TOGGLES):
   - Are required drawers, accordions, or sliders closed or unexpanded when they should be opened to view target details? If so, IT IS INVALID (valid: false) with issue: "unopened_container".
5. ERROR OR BLANK STATE:
   - If the page is blank, errored, or obscured by an overlay, IT IS INVALID (valid: false).

Respond strictly with a JSON object:
{
  "valid": true | false,
  "issue": "marketing_landing_page" | "search_results_list" | "cookie_popup" | "blank_page" | "truncated_content" | "unopened_container" | "wrong_topic" | "none",
  "reason": "Clear explanation in Indonesian or English of what the screenshot actually shows and why it passes or fails",
  "suggested_action": "e.g. 'Scroll down to reveal truncated content', 'Click target detail link [index]', 'Expand accordion or drawer', 'Search on Google for working portal'"
}`;

      const evalUserPrompt = `User Goal: "${userGoal}"\nCurrent Webpage URL: "${currentUrl}"\n\nCarefully inspect the screenshot image above. Does this image show the true substantive information requested, without being truncated, blocked, or stuck on a search list? Return your JSON evaluation.`;

      try {
        let rawResponse = '';
        if (this.provider === 'gemini') {
          rawResponse = await this._callGemini(evalSystemPrompt, evalUserPrompt, cleanBase64);
        } else if (this.provider === 'openai' || this.provider === 'custom_openai') {
          rawResponse = await this._callOpenAI(evalSystemPrompt, evalUserPrompt, cleanBase64);
        } else if (this.provider === 'anthropic') {
          rawResponse = await this._callAnthropic(evalSystemPrompt, evalUserPrompt, cleanBase64);
        } else {
          return { valid: true, reason: 'Evaluasi dilewati (provider non-vision)', issue: 'none' };
        }

        const parsed = this._parseActionJSON(rawResponse);
        return {
          valid: parsed.valid !== false,
          issue: parsed.issue || 'none',
          reason: parsed.reason || 'Screenshot visual dievaluasi.',
          suggested_action: parsed.suggested_action || '',
        };
      } catch (err) {
        return { valid: true, reason: `Visual check bypassed (${err.message})`, issue: 'none' };
      }
    }


    /**
     * Resilient fetch with retry for transient network hiccups or socket drops.
     */
    async _fetchWithRetry(url, options = {}, maxRetries = 2) {
      let lastErr;
      const abortCtrl = new AbortController();
      this.currentAbortController = abortCtrl;
      const signal = options.signal || abortCtrl.signal;
      const fetchOpts = { ...options, signal };

      try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (signal.aborted) {
              const abortErr = new Error('Operasi AI dibatalkan oleh pengguna.');
              abortErr.name = 'AbortError';
              throw abortErr;
            }
            const res = await fetch(url, fetchOpts);
            return res;
          } catch (err) {
            lastErr = err;
            if (err.name === 'AbortError' || signal.aborted) {
              throw err;
            }
            if (attempt < maxRetries) {
              console.warn(`[LLMClient] Network fetch attempt ${attempt} failed (${err.message}). Retrying in 1.2s...`);
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      } finally {
        if (this.currentAbortController === abortCtrl) {
          this.currentAbortController = null;
        }
      }
    }

    // ─── Gemini Provider ───────────────────────────────────────────────────────
    async _callGemini(systemPrompt, textPrompt, screenshotBase64, _retryWithoutImage = false) {
      if (!this.apiKey) {
        throw new Error('Google Gemini API Key belum diisi. Masukkan API Key di pengaturan (ikon kunci).');
      }

      let modelName = this.model;
      if (modelName.startsWith('gemini/')) modelName = modelName.slice(7);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const parts = [];

      // Add screenshot image if available (skip on retry to avoid vision safety trigger)
      if (screenshotBase64 && !_retryWithoutImage) {
        parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: screenshotBase64,
          },
        });
      }

      // Guard: Trim textPrompt if it approaches the input token limit (~28k chars ≈ 7k tokens).
      // Oversized prompts cause Gemini to truncate or refuse, returning empty candidates.
      const MAX_PROMPT_CHARS = 28000;
      const trimmedPrompt = textPrompt.length > MAX_PROMPT_CHARS
        ? textPrompt.slice(0, MAX_PROMPT_CHARS) + '\n[... CONTEXT TRIMMED DUE TO LENGTH LIMIT ...]'
        : textPrompt;

      parts.push({ text: trimmedPrompt });

      const body = {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        // NOTE: Do NOT set responseMimeType: 'application/json' here.
        // When Gemini's safety filter fires in JSON-only mode it returns an empty
        // candidate (no text, no tool calls) which causes the error:
        //   "model output must contain either output text or tool calls"
        // We parse JSON ourselves via _parseActionJSON, so plain text output is fine.
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
        // Relax safety thresholds so browsing content doesn't get blocked unnecessarily
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      };

      const res = await this._fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        const err = new Error(`Gemini API Error: ${msg}`);
        err.status = res.status;
        err.statusCode = res.status;
        throw err;
      }

      const data = await res.json();

      // Detect blocked / empty candidates and surface finishReason clearly
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason || '';

      if (!candidate || !candidate.content) {
        const blockReason = data?.promptFeedback?.blockReason || '';

        // Auto-retry without image: vision content sometimes trips safety filters.
        // Only retry once and only when an image was included in the original call.
        if (!_retryWithoutImage && screenshotBase64) {
          console.warn('[LLMClient] Gemini empty candidate with image — retrying without screenshot...');
          return this._callGemini(systemPrompt, textPrompt, null, true);
        }

        const safetyDetail = blockReason
          ? `Prompt diblokir oleh safety filter Gemini: ${blockReason}`
          : finishReason === 'MAX_TOKENS'
            ? 'Output terpotong karena melebihi batas token Gemini. Kurangi konteks atau histories.'
            : finishReason === 'RECITATION'
              ? 'Gemini menolak output karena recitation/copyright policy.'
              : finishReason === 'SAFETY'
                ? 'Gemini memblokir output karena safety policy.'
                : `Gemini mengembalikan kandidat kosong (finishReason: ${finishReason || 'UNKNOWN'}).`;
        throw new Error(safetyDetail);
      }

      // Collect all text parts (Gemini may split output across multiple parts)
      const allParts = candidate.content?.parts || [];
      const text = allParts.map(p => p.text || '').join('').trim();

      if (!text) {
        // One final retry without image before giving up
        if (!_retryWithoutImage && screenshotBase64) {
          console.warn('[LLMClient] Gemini returned empty text — retrying without screenshot...');
          return this._callGemini(systemPrompt, textPrompt, null, true);
        }
        throw new Error(`Gemini mengembalikan teks kosong (finishReason: ${finishReason || 'STOP'}).`);
      }

      return text;
    }

    // ─── OpenAI / Custom OpenAI-Compatible Provider ───────────────────────────
    async _callOpenAI(systemPrompt, textPrompt, screenshotBase64) {
      if (!this.apiKey && this.provider !== 'custom_openai') {
        throw new Error('API Key belum diisi. Masukkan API Key di pengaturan.');
      }

      let modelName = this.model;
      if (modelName.startsWith('openai/')) modelName = modelName.slice(7);
      if (modelName.startsWith('custom/')) modelName = modelName.slice(7);

      const userContent = [];
      if (screenshotBase64) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${screenshotBase64}` },
        });
      }
      userContent.push({ type: 'text', text: textPrompt });

      const body = {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: this.temperature ?? 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      };

      let endpoint = 'https://api.openai.com/v1/chat/completions';
      if (this.baseUrl) {
        let base = this.baseUrl.trim().replace(/\/+$/, '');
        if (base.endsWith('/chat/completions')) {
          endpoint = base;
        } else if (base.endsWith('/v1')) {
          endpoint = `${base}/chat/completions`;
        } else {
          endpoint = `${base}/v1/chat/completions`;
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await this._fetchWithRetry(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });


      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        const err = new Error(`OpenAI API Error: ${msg}`);
        err.status = res.status;
        err.statusCode = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('OpenAI returned empty content');
      return text;
    }

    // ─── Anthropic Provider ───────────────────────────────────────────────────
    async _callAnthropic(systemPrompt, textPrompt, screenshotBase64) {
      if (!this.apiKey) {
        throw new Error('Anthropic API Key belum diisi. Masukkan API Key di pengaturan.');
      }

      let modelName = this.model;
      if (modelName.startsWith('anthropic/')) modelName = modelName.slice(10);

      const userContent = [];
      if (screenshotBase64) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: screenshotBase64,
          },
        });
      }
      userContent.push({ type: 'text', text: textPrompt });

      const body = {
        model: modelName,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 2048,
        temperature: 0.1,
      };

      const res = await this._fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        const err = new Error(`Anthropic API Error: ${msg}`);
        err.status = res.status;
        err.statusCode = res.status;
        throw err;
      }

      const data = await res.json();
      const textBlock = data?.content?.find(c => c.type === 'text');
      const text = textBlock ? textBlock.text : '';
      if (!text) throw new Error('Anthropic returned empty response');
      return text;
    }

    // ─── Ollama Provider ───────────────────────────────────────────────────────
    async _callOllama(systemPrompt, textPrompt, screenshotBase64) {
      let modelName = this.model;
      if (modelName.startsWith('ollama/')) modelName = modelName.slice(7);

      const host = this.ollamaHost || 'http://localhost:11434';
      const url = `${host.replace(/\/+$/, '')}/api/chat`;

      const userMsg = { role: 'user', content: textPrompt };
      if (screenshotBase64) {
        userMsg.images = [screenshotBase64];
      }

      const body = {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          userMsg,
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.1 },
      };

      let res;
      try {
        res = await this._fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new Error(`Gagal terhubung ke Ollama (${url}). Pastikan Ollama berjalan di komputer Anda.`);
      }

      if (!res.ok) {
        throw new Error(`Ollama Error: HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const text = data?.message?.content || '';
      if (!text) throw new Error('Ollama returned empty response');
      return text;
    }

    // ─── JSON Parser & Recovery ────────────────────────────────────────────────
    _parseActionJSON(raw) {
      const clean = String(raw || '').trim();

      const tryParse = (str) => {
        try {
          const obj = JSON.parse(str);
          if (obj && typeof obj === 'object') return obj;
        } catch {}
        return null;
      };

      // 1. Direct JSON.parse
      let parsed = tryParse(clean);
      if (parsed) return this._validateActionObject(parsed);

      // 2. Extract from ```json ... ``` code fence
      const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) {
        parsed = tryParse(fenceMatch[1].trim());
        if (parsed) return this._validateActionObject(parsed);
      }

      // 3. Balanced Braces Extraction (safely skips trailing braces like } } or post-json chatter)
      const balancedJSON = this._extractBalancedJSON(clean);
      if (balancedJSON) {
        parsed = tryParse(balancedJSON);
        if (parsed) return this._validateActionObject(parsed);
      }

      // 4. Heuristic slice between first '{' and last '}' with trailing closing brace trimming
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        let candidate = clean.slice(firstBrace, lastBrace + 1);
        parsed = tryParse(candidate);
        if (parsed) return this._validateActionObject(parsed);

        // Try trimming trailing duplicate braces
        while (candidate.endsWith('}}') || candidate.endsWith('}\n}') || candidate.endsWith('} }')) {
          candidate = candidate.slice(0, candidate.lastIndexOf('}')).trim();
          parsed = tryParse(candidate);
          if (parsed) return this._validateActionObject(parsed);
        }
      }

      // 5. Intelligent Action Recovery via Regex
      // If the model intended an action (e.g. highlight_text, click_element), recover it instead of failing to done!
      const actionMatch = clean.match(/"action_name"\s*:\s*"([^"]+)"/i) || clean.match(/"action"\s*:\s*"([^"]+)"/i);
      if (actionMatch) {
        const action_name = actionMatch[1].trim();
        const thinkingMatch = clean.match(/"thinking"\s*:\s*"((?:\\.|[^"\\])*)"/i);
        const thinking = thinkingMatch ? thinkingMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';

        // Extract parameters block: "parameters": { ... }
        const paramIndex = clean.indexOf('"parameters"');
        let params = {};
        if (paramIndex !== -1) {
          const paramSubstring = clean.slice(paramIndex);
          const paramJSON = this._extractBalancedJSON(paramSubstring);
          if (paramJSON) {
            params = tryParse(paramJSON) || {};
          }
        }

        // If parameters JSON extraction failed, recover known individual parameters via regex
        if (Object.keys(params).length === 0) {
          const textMatch = clean.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/i);
          const colorMatch = clean.match(/"color"\s*:\s*"([^"]+)"/i);
          const indexMatch = clean.match(/"index"\s*:\s*(\d+)/i);
          const scrollMatch = clean.match(/"scroll_to"\s*:\s*(true|false)/i);
          const urlMatch = clean.match(/"url"\s*:\s*"([^"]+)"/i);
          
          if (textMatch) params.text = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          if (colorMatch) params.color = colorMatch[1];
          if (indexMatch) params.index = parseInt(indexMatch[1], 10);
          if (scrollMatch) params.scroll_to = scrollMatch[1] === 'true';
          if (urlMatch) params.url = urlMatch[1];
        }

        return this._validateActionObject({
          thinking: thinking || 'Recovered action from LLM output',
          action_name,
          parameters: params,
        });
      }

      // 6. Conversational Plain-Text Fallback
      // Strip any stray JSON envelope so raw JSON syntax never leaks to the user chat
      let cleanedText = clean
        .replace(/^\s*\{[\s\S]*?"thinking":\s*"/i, '')
        .replace(/"\s*,?\s*\}?\s*$/i, '')
        .trim();

      return {
        thinking: 'Output formatted as text response',
        action_name: 'done',
        parameters: { text: cleanedText || clean, success: true },
      };
    }

    /**
     * Extracts the first balanced JSON { ... } substring respecting string boundaries and escapes.
     */
    _extractBalancedJSON(str) {
      if (!str) return null;
      const startIdx = str.indexOf('{');
      if (startIdx === -1) return null;

      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = startIdx; i < str.length; i++) {
        const char = str[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0) {
              return str.slice(startIdx, i + 1);
            }
          }
        }
      }
      return null;
    }

    _validateActionObject(obj) {
      if (!obj || typeof obj !== 'object') {
        throw new Error('Parsed action is not a valid object');
      }

      const thinking = obj.thinking || obj.reasoning || obj.thought || '';
      let action_name = obj.action_name || obj.action || obj.name || '';
      let parameters = obj.parameters || obj.params || obj.args || {};

      // Normalize if action was nested inside an action object
      if (typeof action_name === 'object' && action_name !== null) {
        parameters = action_name.parameters || action_name.params || parameters;
        action_name = action_name.name || action_name.action_name || '';
      }

      action_name = String(action_name).trim().toLowerCase();

      // Priority 2: Multi-Action Pipeline support
      let actions = [];
      if (Array.isArray(obj.actions) && obj.actions.length > 0) {
        actions = obj.actions.map(a => {
          let aName = a.action_name || a.action || a.name || '';
          let aParams = a.parameters || a.params || a.args || {};
          if (typeof aName === 'object' && aName !== null) {
            aParams = aName.parameters || aName.params || aParams;
            aName = aName.name || aName.action_name || '';
          }
          return {
            action_name: String(aName).trim().toLowerCase(),
            parameters: typeof aParams === 'object' && aParams !== null ? aParams : {},
          };
        }).filter(a => a.action_name);
      }

      if (actions.length === 0 && action_name) {
        actions = [{
          action_name,
          parameters: typeof parameters === 'object' && parameters !== null ? parameters : {},
        }];
      }

      if (actions.length > 0 && !action_name) {
        action_name = actions[0].action_name;
        parameters = actions[0].parameters;
      }

      // Priority 2: Plan State Machine fields
      const plan_update = Array.isArray(obj.plan_update) ? obj.plan_update.map(String) : (Array.isArray(obj.plan) ? obj.plan.map(String) : null);
      const current_plan_item = typeof obj.current_plan_item === 'number' ? obj.current_plan_item : (typeof obj.current_step === 'number' ? obj.current_step : null);

      // Preserve evaluation / verdict fields (for Trace Judge and Evaluation Systems)
      const verdict = typeof obj.verdict === 'boolean' ? obj.verdict : (typeof parameters.verdict === 'boolean' ? parameters.verdict : undefined);
      const evalReasoning = obj.reasoning || (typeof parameters.reasoning === 'string' ? parameters.reasoning : undefined);
      const failure_reason = obj.failure_reason !== undefined ? obj.failure_reason : (parameters.failure_reason !== undefined ? parameters.failure_reason : null);
      const impossible_task = typeof obj.impossible_task === 'boolean' ? obj.impossible_task : (typeof parameters.impossible_task === 'boolean' ? parameters.impossible_task : false);
      const reached_captcha = typeof obj.reached_captcha === 'boolean' ? obj.reached_captcha : (typeof parameters.reached_captcha === 'boolean' ? parameters.reached_captcha : false);
      const score = typeof obj.score === 'number' ? obj.score : (typeof parameters.score === 'number' ? parameters.score : undefined);
      const confidence = typeof obj.confidence === 'number' ? obj.confidence : (typeof parameters.confidence === 'number' ? parameters.confidence : undefined);

      return {
        thinking: String(thinking),
        action_name,
        parameters: typeof parameters === 'object' && parameters !== null ? parameters : {},
        actions,
        plan_update,
        current_plan_item,
        verdict,
        reasoning: evalReasoning,
        failure_reason,
        impossible_task,
        reached_captcha,
        score,
        confidence,
        rawParsed: obj,
      };
    }

    /**
     * Generates a short, intelligent 3-5 word session title from a user prompt or conversation context.
     * @param {string} promptText
     * @returns {Promise<string>}
     */
    async generateTitle(promptText) {
      if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
        return '';
      }

      const systemInstruction = [
        'You are a concise session title generator.',
        'Summarize the user request into a concise 3 to 5 word session title.',
        'Rules:',
        '- Return ONLY the title text, nothing else.',
        '- Do NOT wrap in quotes, markdown, or add trailing punctuation.',
        '- Match the exact language of the prompt (Indonesian or English).',
        '- Maximum 36 characters.',
      ].join('\n');

      const userContent = promptText.trim().slice(0, 1500);

      try {
        let raw = '';
        switch (this.provider) {
          case 'gemini': {
            if (!this.apiKey) return '';
            let modelName = this.model;
            if (modelName.startsWith('gemini/')) modelName = modelName.slice(7);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: 'user', parts: [{ text: userContent }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 60 },
              }),
            });
            if (!res.ok) throw new Error(`Gemini status ${res.status}`);
            const data = await res.json();
            raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            break;
          }
          case 'openai':
          case 'custom_openai': {
            const baseUrl = this.baseUrl || 'https://api.openai.com/v1';
            const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
            const headers = { 'Content-Type': 'application/json' };
            if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: this.model || 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: userContent },
                ],
                temperature: 0.2,
                max_tokens: 60,
              }),
            });
            if (!res.ok) throw new Error(`OpenAI status ${res.status}`);
            const data = await res.json();
            raw = data.choices?.[0]?.message?.content || '';
            break;
          }
          case 'anthropic': {
            if (!this.apiKey) return '';
            const url = 'https://api.anthropic.com/v1/messages';
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: this.model || 'claude-3-5-sonnet-20241022',
                system: systemInstruction,
                messages: [{ role: 'user', content: userContent }],
                max_tokens: 60,
                temperature: 0.2,
              }),
            });
            if (!res.ok) throw new Error(`Anthropic status ${res.status}`);
            const data = await res.json();
            raw = data.content?.[0]?.text || '';
            break;
          }
          case 'ollama': {
            const url = `${this.ollamaHost.replace(/\/+$/, '')}/api/chat`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: this.model || 'llama3',
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: userContent },
                ],
                stream: false,
              }),
            });
            if (!res.ok) throw new Error(`Ollama status ${res.status}`);
            const data = await res.json();
            raw = data.message?.content || '';
            break;
          }
          default:
            break;
        }

        let clean = raw.trim()
          .replace(/^["'`#*]+|["'`#*]+$/g, '')
          .replace(/^(Judul|Title|Session):\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (clean.length > 38) clean = clean.slice(0, 38).trim() + '...';
        return clean;
      } catch (err) {
        console.warn('[LLMClient] Auto-naming failed:', err);
        return '';
      }
    }
  }

  global.LLMClient = LLMClient;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
