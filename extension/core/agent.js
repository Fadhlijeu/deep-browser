/**
 * Deep Browser Extension — Browser Use Agent Loop & State Machine
 * ===============================================================
 *
 * Full port of the Browser Use Agent lifecycle in pure JavaScript:
 *   1. Perception: Captures DOM state and visual screenshot via BrowserSession.
 *   2. Context: Prepares system prompt & dynamic DOM state via MessageManager.
 *   3. Planning: Calls LLMClient (Gemini, OpenAI, Claude, Ollama) via direct HTTP fetch.
 *   4. Execution: Runs atomic actions via Tools on the active Chrome tab.
 *   5. Verification: Evaluates action results and supports self-correction loops.
 *   6. Event Streaming: Emits rich timeline events directly to the SidePanel UI.
 */

(function(global) {
  'use strict';

  class Agent {
    /**
     * @param {Object} options
     * @param {string} options.task - User task prompt
     * @param {BrowserSession} options.browserSession
     * @param {LLMClient} options.llmClient
     * @param {number} [options.maxSteps=25]
     * @param {string} [options.mode='agent_decide'] - 'agent_decide' | 'auto' | 'hitl'
     * @param {Function} [options.onEvent] - Event listener callback (evt) => {}
     */
    constructor(options = {}) {
      if (!options.task) throw new Error('Agent requires a task prompt');
      this.task = options.task;
      this.browserSession = options.browserSession || new global.BrowserSession();
      this.llmClient = options.llmClient || new global.LLMClient();
      this.tools = new global.Tools(this.browserSession);
      this.messageManager = new global.MessageManager({ task: this.task });
      this.maxSteps = options.maxSteps || 25;
      this.mode = options.mode || 'agent_decide';
      this.onEvent = options.onEvent || (() => {});

      this.step = 0;
      this.isRunning = false;
      this.isStopped = false;
    }

    /**
     * Emits a timeline event to the UI callback.
     */
    _emit(eventType, message, data = {}) {
      const evt = {
        event_type: eventType,
        message: message || '',
        data: data || {},
        step: this.step,
        timestamp: Date.now(),
      };
      try {
        this.onEvent(evt);
      } catch (err) {
        console.error('[Agent] onEvent error:', err);
      }
    }

    /**
     * Stops the running agent execution.
     */
    stop() {
      this.isStopped = true;
      this.isRunning = false;
      this._emit('STOPPED', 'Agent dihentikan oleh pengguna');
    }

    /**
     * Executes the autonomous Browser Use loop.
     * @returns {Promise<Object>} Final result summary
     */
    async run() {
      if (this.isRunning) throw new Error('Agent is already running');
      this.isRunning = true;
      this.isStopped = false;
      this.step = 0;

      this._emit('TASK_STARTED', `Tugas dimulai: "${this.task}"`, { task: this.task });

      const systemPrompt = this.messageManager.getSystemPrompt();

      try {
        // Step 0: Ensure tab is attached
        const tab = await this.browserSession.attach();
        this._emit('CONTEXT_ATTACHED', `Terhubung ke tab: ${tab.title || tab.url}`, {
          tab_id: tab.id,
          url: tab.url,
          title: tab.title,
        });

        while (this.step < this.maxSteps && !this.isStopped) {
          this.step++;

          // 1. Observe browser state & capture screenshot
          const state = await this.browserSession.getState(true);
          if (this.isStopped) break;

          this._emit(
            'OBSERVATION',
            `[Langkah ${this.step}] Halaman: ${state.title || state.url} (${state.elements.length} elemen interaktif)`,
            {
              url: state.url,
              title: state.title,
              elementsCount: state.elements.length,
              scroll_y: state.pageInfo?.scroll_y,
            }
          );

          // 2. Prepare context prompt with DOM tree & history
          const stepPayload = this.messageManager.buildStepPrompt(state, this.step);
          if (this.isStopped) break;

          // 3. Planning: Call LLM
          this._emit('THINKING_STATUS', `[Langkah ${this.step}] Menganalisis elemen dan merencanakan aksi...`, {
            step: this.step,
          });

          let decision;
          try {
            decision = await this.llmClient.planNextStep(systemPrompt, stepPayload);
          } catch (llmErr) {
            throw new Error(`LLM Failure: ${llmErr.message}`);
          }

          if (this.isStopped) break;

          if (decision.thinking) {
            this._emit('THINKING_STATUS', decision.thinking, {
              step: this.step,
              thinking: decision.thinking,
            });
          }

          const actionName = decision.action_name;
          const params = decision.parameters || {};

          // 4. Map action to UI event card
          this._emitActionCard(actionName, params);

          // 5. Execute action on BrowserSession
          const actionResult = await this.tools.execute(actionName, params);
          if (this.isStopped) break;

          // 6. Record step in MessageManager history for self-correction & reflection
          this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, actionResult);

          // 7. Check completion conditions
          if (actionName === 'done' || actionResult.data?.is_done) {
            const finalAnswer = actionResult.data?.text || params.text || 'Tugas selesai.';
            this.isRunning = false;
            this._emit('COMPLETED', finalAnswer, {
              result: finalAnswer,
              totalSteps: this.step,
              success: actionResult.data?.success !== false,
            });
            return {
              success: true,
              result: finalAnswer,
              totalSteps: this.step,
            };
          }

          // Small pause between steps for DOM stabilization
          await new Promise(r => setTimeout(r, 600));
        }

        if (this.isStopped) {
          return { success: false, error: 'Agent stopped by user' };
        }

        // Max steps reached fallback
        const maxStepMsg = `Mencapai batas maksimum ${this.maxSteps} langkah.`;
        this._emit('COMPLETED', maxStepMsg, { result: maxStepMsg, totalSteps: this.step, success: false });
        return { success: false, error: maxStepMsg };

      } catch (err) {
        this.isRunning = false;
        this._emit('FAILED', err.message || String(err), { error: err.message });
        throw err;
      } finally {
        this.isRunning = false;
      }
    }

    _emitActionCard(actionName, params) {
      switch (actionName) {
        case 'click_element':
          this._emit('CLICK', `Klik elemen [${params.index}]`, { target: `[${params.index}]`, ...params });
          break;
        case 'input_text':
          this._emit('TYPE', `Ketik "${params.text}" pada elemen [${params.index}]`, { target: `[${params.index}]`, ...params });
          break;
        case 'navigate':
          this._emit('NAVIGATE', `Navigasi ke: ${params.url}`, { url: params.url, ...params });
          break;
        case 'scroll_page':
        case 'scroll_to_text':
          this._emit('SCROLL', `Scroll ${params.direction || 'halaman'}`, params);
          break;
        case 'send_keys':
          this._emit('ACTION', `Kirim tombol: ${params.keys}`, params);
          break;
        case 'wait':
          this._emit('THINKING_STATUS', `Menunggu ${params.seconds || 3} detik...`, params);
          break;
        case 'go_back':
          this._emit('NAVIGATE', 'Kembali ke halaman sebelumnya', params);
          break;
        case 'go_forward':
          this._emit('NAVIGATE', 'Maju ke halaman berikutnya', params);
          break;
        case 'refresh':
          this._emit('NAVIGATE', 'Memuat ulang halaman', params);
          break;
        case 'done':
          // Handled in completion logic
          break;
        default:
          this._emit('ACTION', `Aksi: ${actionName}`, params);
      }
    }
  }

  global.Agent = Agent;
})(typeof window !== 'undefined' ? window : this);
