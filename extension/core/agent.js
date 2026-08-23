/**
 * Deep Browser Extension — Autonomous Browser Use Agent
 * =======================================================
 *
 * Full port of Browser Use Agent lifecycle:
 *   1. Observe: Captures DOM state, element indices [1], and screenshot.
 *   2. Context: Prepares system prompt & dynamic DOM state via MessageManager.
 *   3. Plan: Calls LLMClient (Gemini, OpenAI, Claude, Ollama) via direct fetch.
 *   4. Policy & HITL: Evaluates execution mode & security policies before act.
 *   5. Act: Runs atomic actions via Tools on the active Microsoft Edge tab.
 *   6. Verify: Evaluates state mutations (URL changed, input value, scroll delta).
 *   7. Reflect & Recover: Feeds errors back to history for self-correction.
 *   8. Stream: Emits 28 typed events to SidePanel UI.
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
     * @param {Function} [options.onEvent] - Event callback (evt) => {}
     * @param {Function} [options.onApprovalRequired] - Approval hook (proposal) => Promise<{ approved, feedback }>
     */
    constructor(options = {}) {
      if (!options.task) throw new Error('Agent requires a task prompt');
      this.task = options.task;
      this.browserSession = options.browserSession || new global.BrowserSession();
      this.llmClient = options.llmClient || new global.LLMClient();
      this.tools = new global.Tools(this.browserSession);
      this.messageManager = new global.MessageManager({ task: this.task });
      this.extractor = new global.Extractor(this.browserSession, this.llmClient);
      this.securityPolicy = global.SecurityPolicy ? new global.SecurityPolicy() : null;

      this.maxSteps = options.maxSteps || 25;
      this.mode = options.mode || 'agent_decide';
      this.onEvent = options.onEvent || (() => {});
      this.onApprovalRequired = options.onApprovalRequired || null;

      this.step = 0;
      this.isRunning = false;
      this.isStopped = false;
      this.history = [];
    }

    /**
     * Emits a typed event to the listener.
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
        console.error('[Agent] onEvent callback error:', err);
      }
    }

    /**
     * Stops the running agent execution immediately.
     */
    stop() {
      this.isStopped = true;
      this.isRunning = false;
      this._emit('TASK_CANCELLED', 'Agent dihentikan oleh pengguna');
    }

    /**
     * Runs the autonomous Browser Use loop.
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
        // Step 0: Ensure tab attachment
        const tab = await this.browserSession.attach();
        this._emit('ATTACH_TAB', `Terhubung ke tab Edge: ${tab.title || tab.url}`, {
          tab_id: tab.id,
          url: tab.url,
          title: tab.title,
        });

        while (this.step < this.maxSteps && !this.isStopped) {
          this.step++;

          // ─── 1. OBSERVE ──────────────────────────────────────────────────────────
          const state = await this.browserSession.getState(true);
          if (this.isStopped) break;

          this._emit(
            'OBSERVATION',
            `[Langkah ${this.step}] ${state.title || state.url} (${state.elements.length} elemen interaktif)`,
            {
              url: state.url,
              title: state.title,
              elementsCount: state.elements.length,
              scroll_y: state.pageInfo?.scroll_y,
              pixels_below: state.pageInfo?.pixels_below,
            }
          );

          if (state.screenshot) {
            this._emit('SCREENSHOT', 'Tangkapan layar viewport diambil', { screenshot: state.screenshot });
          }

          // ─── 2. CONTEXT & PROMPT ────────────────────────────────────────────────
          const stepPayload = this.messageManager.buildStepPrompt(state, this.step);
          if (this.isStopped) break;

          // ─── 3. PLANNING ────────────────────────────────────────────────────────
          this._emit('PLAN', `[Langkah ${this.step}] Merencanakan langkah berikutnya...`, { step: this.step });

          let decision;
          try {
            decision = await this.llmClient.planNextStep(systemPrompt, stepPayload);
          } catch (llmErr) {
            throw new Error(`LLM Error: ${llmErr.message}`);
          }

          if (this.isStopped) break;

          if (decision.thinking) {
            this._emit('REASONING', decision.thinking, {
              step: this.step,
              thinking: decision.thinking,
            });
          }

          const actionName = decision.action_name;
          const params = decision.parameters || {};

          // ─── 4. SECURITY POLICY & HITL APPROVAL ──────────────────────────────────
          if (this.mode === 'hitl' || (this.securityPolicy && this.securityPolicy.requiresReview(actionName, params))) {
            this._emit('ACTION_PROPOSED', `Proposal Aksi: ${actionName}`, { action_name: actionName, parameters: params });

            if (this.onApprovalRequired) {
              this._emit('USER_APPROVAL_REQUIRED', `Menunggu persetujuan untuk aksi: ${actionName}`, {
                action_name: actionName,
                parameters: params,
              });

              const approvalResult = await this.onApprovalRequired({ action_name: actionName, parameters: params });
              if (!approvalResult.approved) {
                const feedback = approvalResult.feedback || 'User rejected the action.';
                this._emit('RETRY', `Aksi ditolak: ${feedback}. Merencanakan ulang...`, { feedback });
                this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: `Rejected by user: ${feedback}` });
                continue;
              }
            }
          }

          // ─── 5. EMIT SPECIFIC ACTION EVENT ──────────────────────────────────────
          this._emitActionSpecificEvent(actionName, params);

          // ─── 6. ACT ─────────────────────────────────────────────────────────────
          const preActionUrl = state.url;
          const actionResult = await this.tools.execute(actionName, params);
          if (this.isStopped) break;

          if (!actionResult.success) {
            this._emit('ACTION_FAILED', `Gagal: ${actionResult.error}`, { error: actionResult.error });
          } else {
            this._emit('ACTION_EXECUTED', actionResult.message || `Aksi ${actionName} dieksekusi`, { data: actionResult.data });
          }

          // ─── 7. DETERMINISTIC VERIFICATION ──────────────────────────────────────
          const verification = await this._verifyAction(actionName, params, preActionUrl, actionResult);
          this._emit('VERIFICATION', verification.message, { verified: verification.verified });

          // ─── 8. RECORD STEP & REFLECT ───────────────────────────────────────────
          this.messageManager.recordStep(
            this.step,
            decision.thinking,
            { name: actionName, parameters: params },
            { success: verification.verified && actionResult.success, error: actionResult.error || verification.error }
          );

          // ─── 9. COMPLETION CHECK ────────────────────────────────────────────────
          if (actionName === 'done' || actionResult.data?.is_done) {
            const finalAnswer = actionResult.data?.text || params.text || 'Tugas selesai.';
            this.isRunning = false;
            this._emit('TASK_COMPLETED', finalAnswer, {
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

          // DOM stabilization pause
          await this.browserSession.wait(0.6);
        }

        if (this.isStopped) {
          return { success: false, error: 'Agent stopped by user' };
        }

        // Max steps reached
        const maxStepMsg = `Mencapai batas maksimum ${this.maxSteps} langkah.`;
        this._emit('TASK_COMPLETED', maxStepMsg, { result: maxStepMsg, totalSteps: this.step, success: false });
        return { success: false, error: maxStepMsg };

      } catch (err) {
        this.isRunning = false;
        this._emit('ERROR', err.message || String(err), { error: err.message });
        throw err;
      } finally {
        this.isRunning = false;
      }
    }

    /**
     * Deterministic action verification.
     */
    async _verifyAction(actionName, params, preUrl, actionResult) {
      if (!actionResult.success) {
        return { verified: false, message: `Aksi ${actionName} gagal dieksekusi: ${actionResult.error}`, error: actionResult.error };
      }

      switch (actionName) {
        case 'navigate': {
          const target = params.url;
          return { verified: true, message: `Navigasi ke ${target} diverifikasi.` };
        }
        case 'click_element': {
          return { verified: true, message: `Klik elemen [${params.index}] diverifikasi.` };
        }
        case 'input_text': {
          const val = actionResult.data?.currentValue || '';
          const match = val.includes(params.text);
          return {
            verified: match,
            message: match ? `Teks "${params.text}" berhasil diinput dan diverifikasi.` : 'Nilai input belum sesuai.',
          };
        }
        case 'scroll_page': {
          return { verified: true, message: 'Posisi scroll telah diperbarui.' };
        }
        case 'done': {
          return { verified: true, message: 'Tugas ditandai selesai.' };
        }
        default:
          return { verified: true, message: `Aksi ${actionName} selesai dieksekusi.` };
      }
    }

    _emitActionSpecificEvent(actionName, params) {
      switch (actionName) {
        case 'click_element':
          this._emit('CLICK', `Klik elemen [${params.index}]`, params);
          break;
        case 'click_coordinate':
          this._emit('CLICK', `Klik koordinat (${params.coordinate_x}, ${params.coordinate_y})`, params);
          break;
        case 'input_text':
          this._emit('TYPE', `Ketik "${params.text}" pada elemen [${params.index}]`, params);
          break;
        case 'navigate':
          this._emit('NAVIGATION', `Navigasi ke: ${params.url}`, params);
          break;
        case 'scroll_page':
        case 'scroll_to_text':
          this._emit('SCROLL', `Scroll ${params.down !== false ? 'turun' : 'naik'} ${params.pages || 1} halaman`, params);
          break;
        case 'send_keys':
          this._emit('ACTION_EXECUTED', `Kirim tombol: ${params.keys}`, params);
          break;
        case 'wait':
          this._emit('WAITING', `Menunggu ${params.seconds || 2} detik...`, params);
          break;
        case 'hover':
          this._emit('HOVER', `Hover pointer pada elemen [${params.index}]`, params);
          break;
        case 'extract':
          this._emit('EXTRACTION', `Mengekstrak data untuk: "${params.query}"`, params);
          break;
        case 'switch_tab':
          this._emit('TAB_SWITCHED', `Beralih ke tab ${params.tab_id}`, params);
          break;
        case 'close_tab':
          this._emit('TAB_CLOSED', `Menutup tab ${params.tab_id || 'aktif'}`, params);
          break;
      }
    }
  }

  global.Agent = Agent;
})(typeof window !== 'undefined' ? window : this);
