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
      this.model = config.model || 'gemini-2.0-flash';
      this.apiKey = config.apiKey || '';
      this.baseUrl = config.baseUrl || '';
      this.ollamaHost = config.ollamaHost || 'http://localhost:11434';
      this.temperature = config.temperature ?? 0.1;
    }

    /**
     * Sends context and current state to the LLM and receives structured action decision.
     * @param {string} systemPrompt
     * @param {Object} stepPayload - { textPrompt, screenshotBase64 }
     * @returns {Promise<Object>} { thinking, action_name, parameters }
     */
    async planNextStep(systemPrompt, stepPayload) {
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
1. If the user asked for an ARTICLE, NEWS, or REPORT (e.g. "Cari artikel terbaru mengenai perkembangan AI di Google"):
   - Is this an actual article page with headline, author/date, and paragraphs?
   - Or is this just a generic corporate homepage, marketing landing page (e.g. "Create images", "Try in Gemini", "Flow Agent"), login screen, or cookie popup? If it is a generic marketing/commercial landing page, IT IS INVALID (valid: false)!
2. If the user asked for a PROFILE or BIODATA (e.g. PDDIKTI student profile):
   - Is this an actual profile detail page?
   - Or is this a search results table with multiple rows? If it is just a search results list, IT IS INVALID (valid: false)!
3. If the page is blank, errored, or blocked by a full-screen cookie consent dialog, IT IS INVALID (valid: false).

Respond strictly with a JSON object:
{
  "valid": true | false,
  "issue": "marketing_landing_page" | "search_results_list" | "cookie_popup" | "blank_page" | "wrong_topic" | "none",
  "reason": "Clear explanation in Indonesian or English of what the screenshot actually shows and why it passes or fails",
  "suggested_action": "e.g. 'Search on Google for specific blog article', 'Click target profile link [index]', 'Dismiss cookie popup', 'Scroll down'"
}`;

      const evalUserPrompt = `User Goal: "${userGoal}"\nCurrent Webpage URL: "${currentUrl}"\n\nCarefully inspect the screenshot image above. Does this image show the true substantive information/article/profile requested, or is it a commercial landing page/search list? Return your JSON evaluation.`;

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


    // ─── Gemini Provider ───────────────────────────────────────────────────────
    async _callGemini(systemPrompt, textPrompt, screenshotBase64) {
      if (!this.apiKey) {
        throw new Error('Google Gemini API Key belum diisi. Masukkan API Key di pengaturan (ikon kunci).');
      }

      let modelName = this.model;
      if (modelName.startsWith('gemini/')) modelName = modelName.slice(7);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const parts = [];

      // Add screenshot image if available
      if (screenshotBase64) {
        parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: screenshotBase64,
          },
        });
      }

      // Add text prompt
      parts.push({ text: textPrompt });

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
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(`Gemini API Error: ${msg}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('Gemini API returned empty response');
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });


      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(`OpenAI API Error: ${msg}`);
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

      const res = await fetch('https://api.anthropic.com/v1/messages', {
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
        throw new Error(`Anthropic API Error: ${msg}`);
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
        res = await fetch(url, {
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

      // Attempt 1: Direct JSON.parse
      try {
        const obj = JSON.parse(clean);
        return this._validateActionObject(obj);
      } catch {}

      // Attempt 2: Extract from ```json ... ``` code fence
      const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) {
        try {
          const obj = JSON.parse(fenceMatch[1]);
          return this._validateActionObject(obj);
        } catch {}
      }

      // Attempt 3: Extract first { ... } block
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonSubstring = clean.slice(firstBrace, lastBrace + 1);
          const obj = JSON.parse(jsonSubstring);
          return this._validateActionObject(obj);
        } catch {}
      }

      // Fallback: If unparseable, construct a done or wait action with the raw text
      return {
        thinking: 'Output was not formatted as valid JSON: ' + clean.slice(0, 100),
        action_name: 'done',
        parameters: { text: clean, success: true },
      };
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

      return {
        thinking: String(thinking),
        action_name,
        parameters: typeof parameters === 'object' && parameters !== null ? parameters : {},
      };
    }
  }

  global.LLMClient = LLMClient;
})(typeof window !== 'undefined' ? window : this);
