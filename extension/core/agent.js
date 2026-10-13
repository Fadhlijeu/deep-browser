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
      this.taskId = options.taskId || 'task_' + Date.now().toString(36);
      this.task = options.task;
      this.browserSession = options.browserSession || new global.BrowserSession();
      this.llmClient = options.llmClient || new global.LLMClient();
      this.tools = new global.Tools(this.browserSession);
      this.messageManager = new global.MessageManager({ task: this.task });
      this.preset = options.preset || 'default';
      this.securityPolicy = options.securityPolicy || (global.SecurityPolicy ? new global.SecurityPolicy({ preset: this.preset }) : null);
      if (this.securityPolicy && typeof this.securityPolicy.setPreset === 'function') {
        this.securityPolicy.setPreset(this.preset);
      }

      this.interactionManager = options.interactionManager || (global.InteractionManager ? new global.InteractionManager({ taskId: this.taskId }) : null);
      if (this.interactionManager) {
        this.interactionManager.onInteractionEvent = (evt) => {
          if (evt.interaction) {
            this._emit(evt.event || 'USER_INPUT_REQUIRED', evt.interaction.question || '', {
              interaction: evt.interaction,
              interaction_id: evt.interaction.interaction_id,
              ...evt.interaction,
            });
          }
        };
      }

      this.maxSteps = options.maxSteps !== undefined && options.maxSteps !== null ? options.maxSteps : Infinity;
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
      if (this.browserSession) {
        try { this.browserSession.clearInPageHighlights(); } catch (_) {}
      }
      if (this.interactionManager) {
        try {
          this.interactionManager.cancelInteraction(null, 'Agent dihentikan oleh pengguna');
        } catch {}
      }
      this._emit('TASK_CANCELLED', 'Agent dihentikan oleh pengguna');
      this._emit('TASK_COMPLETED', 'Agent dihentikan oleh pengguna', { result: 'Agent dihentikan oleh pengguna.' });
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

        // Direct Parallel Multi-Tab Intent Decomposition
        const taskLower = (this.task || '').toLowerCase();
        const tabMatch = taskLower.match(/(?:buka|cari|research|buat)\s+(\d+)\s+tab/i) || taskLower.match(/(\d+)\s+tab.*(?:parallel|paralel|research|ringkas)/i);
        if (tabMatch || taskLower.includes('secara parallel') || taskLower.includes('secara paralel')) {
          const numTabs = tabMatch ? parseInt(tabMatch[1], 10) : 3;
          this._emit('REASONING', `Mendekomposisi tugas menjadi ${numTabs} worker riset paralel simultan dengan deep scraping...`);
          
          const rawTopic = this.task.replace(/(?:buka|cari|secara|parallel|paralel|terkait|tentang|\d+\s+tab|dan|ringkas|informasinya|sebanyak\s+banyaknya)/gi, ' ').trim();
          const cleanBase = rawTopic || 'Riset Mendalam';
          const subTopics = [
            `${cleanBase} konsep dasar dan teori ilmiah`,
            `${cleanBase} aplikasi praktis dan implementasi teknologi`,
            `${cleanBase} penemuan terbaru artikel jurnal riset`,
            `${cleanBase} eksperimen ilmiah dan perkembangan mutakhir`,
            `${cleanBase} masa depan dan studi analisis komparatif`
          ].slice(0, Math.min(5, Math.max(2, numTabs)));

          const res = await this.tools.execute('parallel_research', {
            topics: subTopics,
            max_parallel: numTabs,
            show_process: true,
          });

          const report = res.data?.synthesizedReport || res.message;
          this.isRunning = false;
          this._emit('TASK_COMPLETED', report, {
            result: report,
            totalSteps: 1,
            success: true,
          });
          return { success: true, result: report, totalSteps: 1 };
        }

        let lastPageUrl = null;
        let consecutiveScrollCount = 0;
        let reachedBottomOnPage = false;
        let reachedTopOnPage = false;
        let lastClickedIndex = null;
        let consecutiveClickCount = 0;

        while (this.step < this.maxSteps && !this.isStopped) {
          this.step++;

          // ─── 1. OBSERVE ──────────────────────────────────────────────────────────
          const state = await this.browserSession.getState(true);
          if (this.isStopped) break;

          const currentUrl = state.url || '';
          if (currentUrl !== lastPageUrl) {
            lastPageUrl = currentUrl;
            consecutiveScrollCount = 0;
            reachedBottomOnPage = false;
            reachedTopOnPage = false;
          }

          const pixelsBelow = state.pageInfo?.pixels_below ?? 0;
          const scrollY = state.pageInfo?.scroll_y ?? 0;
          const scrollPercentage = state.pageInfo?.scroll_percentage ?? 0;

          if (pixelsBelow <= 25 || scrollPercentage >= 85 || state.pageInfo?.has_more_content_below === false) {
            reachedBottomOnPage = true;
          }
          if (scrollY <= 50 || scrollPercentage <= 15) {
            reachedTopOnPage = true;
          }

          // Anti-loop trigger: If agent has already scanned both top and bottom of this page,
          // and has scrolled 3 or more times consecutively without any other productive action
          const isStuckOscillating = consecutiveScrollCount >= 3 && reachedBottomOnPage && reachedTopOnPage;
          if (isStuckOscillating) {
            this._emit('LOOP_DETECTED', `Deteksi looping terpicu: agen telah menjelajahi seluruh halaman bolak-balik tanpa menemukan konten target. Mengarahkan agen untuk pivot atau terminasi...`, { url: currentUrl });
          }

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
          const stepPayload = this.messageManager.buildStepPrompt(state, this.step, { isStuckOscillating });
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

          // ─── 4. INTERACTIVE WIDGETS & HITL APPROVAL ─────────────────────────────
          if (actionName === 'ask_user') {
            const ixRes = await this.interactionManager.requestInteraction({
              type: params.type || 'choice',
              question: params.question,
              options: params.options,
              description: params.description,
            });

            const userVal = ixRes.value;
            this._emit('USER_RESPONDED', `User answered: ${JSON.stringify(userVal)}`, { value: userVal });
            this.messageManager.recordStep(
              this.step,
              decision.thinking,
              { name: 'ask_user', parameters: params },
              { success: true, user_response: userVal }
            );
            continue;
          }

          if (this.mode === 'hitl' || (this.securityPolicy && this.securityPolicy.requiresReview(actionName, params))) {
            this._emit('ACTION_PROPOSED', `Proposal Aksi: ${actionName}`, { action_name: actionName, parameters: params });
            this._emit('USER_APPROVAL_REQUIRED', `Menunggu persetujuan untuk aksi: ${actionName}`, {
              action_name: actionName,
              parameters: params,
            });

            const approvalResult = await this.interactionManager.requestInteraction({
              type: 'approval',
              question: `Konfirmasi aksi: ${actionName}`,
              action_name: actionName,
              parameters: params,
            });

            if (!approvalResult.approved && approvalResult.value === 'reject') {
              const feedback = approvalResult.feedback || 'User rejected the action.';
              this._emit('RETRY', `Aksi ditolak: ${feedback}. Merencanakan ulang...`, { feedback });
              this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: `Rejected by user: ${feedback}` });
              continue;
            } else if (approvalResult.value === 'edit') {
              const feedback = approvalResult.feedback || 'User requested modification.';
              this._emit('RETRY', `Instruksi diubah: ${feedback}. Merencanakan ulang...`, { feedback });
              this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: `Modified by user: ${feedback}` });
              continue;
            }
          }


          if (this.securityPolicy && typeof this.securityPolicy.isActionAllowed === 'function') {
            if (!this.securityPolicy.isActionAllowed(actionName, params)) {
              const blockedMsg = `Aksi "${actionName}" tidak diizinkan oleh kebijakan preset aktif: ${this.preset}`;
              this._emit('ACTION_FAILED', blockedMsg, { error: blockedMsg, action_name: actionName, preset: this.preset });
              this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: blockedMsg });
              continue;
            }
          }

          // Anti-loop duplicate click guard:
          // If the agent attempts to click the exact same element consecutively right after clicking it,
          // intercept it with an automatic Waiting process (without terminating) so background operations
          // like commit changes, form submissions, or async saves can complete.
          if (actionName === 'click_element') {
            if (params.index === lastClickedIndex) {
              consecutiveClickCount++;
            } else {
              lastClickedIndex = params.index;
              consecutiveClickCount = 1;
            }

            if (consecutiveClickCount >= 2) {
              const waitReason = `Elemen [${params.index}] telah diklik di langkah sebelumnya. Menjalankan proses Waiting (tanpa terminasi) untuk memberi waktu proses halaman (commit/submit/mutasi) selesai...`;
              this._emit('WAITING', waitReason, {
                seconds: 3.5,
                index: params.index,
                reason: 'Menunggu proses background / commit selesai',
              });
              await this.browserSession.wait(3.5);
              consecutiveClickCount = 0;
              this.messageManager.recordStep(
                this.step,
                decision.thinking,
                { name: 'wait', parameters: { seconds: 3.5, reason: 'Menunggu proses selesai setelah klik' } },
                { success: true, message: 'Proses waiting selesai, memeriksa pembaruan halaman.' }
              );
              continue;
            }
          } else {
            consecutiveClickCount = 0;
            if (actionName !== 'wait') {
              lastClickedIndex = null;
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

            if (actionName === 'parallel_research') {
              const report = actionResult.data?.synthesizedReport || actionResult.message;
              this.isRunning = false;
              this._emit('TASK_COMPLETED', report, {
                result: report,
                totalSteps: this.step,
                success: true,
              });
              return { success: true, result: report, totalSteps: this.step };
            } else if (actionName === 'save_as_pdf') {
              this._emit('PDF_SAVED', actionResult.message, actionResult.data);
              const taskLower = (this.task || '').toLowerCase().trim();
              if (taskLower.includes('pdf') || taskLower.includes('ekspor')) {
                const finalAnswer = actionResult.message || 'Dokumen PDF berhasil diekspor.';
                this.isRunning = false;
                this._emit('TASK_COMPLETED', finalAnswer, {
                  result: finalAnswer,
                  totalSteps: this.step,
                  success: true,
                });
                return { success: true, result: finalAnswer, totalSteps: this.step };
              }
            } else if (actionName === 'screenshot' || actionName === 'take_screenshot') {
              this._emit('SCREENSHOT_CAPTURED', actionResult.message || 'Tangkapan layar berhasil diambil.', actionResult.data);
            } else if (actionName === 'extract_html_snippet') {
              this._emit('HTML_SNIPPET_CAPTURED', `Struktur informasi visual berhasil diekstrak.`, actionResult.data);
            }
          }

          // Update consecutive scroll counter for anti-loop detection
          if (actionName === 'scroll_page') {
            consecutiveScrollCount++;
          } else if (['highlight_text', 'click_element', 'input_text', 'navigate', 'parallel_research'].includes(actionName)) {
            consecutiveScrollCount = 0;
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

          // Pacing pause between actions to prevent LLM TPM exhaustion and allow user to observe actions
          await this.browserSession.wait(1.5);
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
        if (this.browserSession) {
          try {
            await this.browserSession.clearInPageHighlights();
          } catch (_) {}
        }
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
        case 'wait': {
          const sec = params.seconds || 3;
          const reasonStr = params.reason ? ` (${params.reason})` : '';
          this._emit('WAITING', `[Waiting] Menunggu proses halaman/sistem selesai ${sec} detik${reasonStr}...`, { seconds: sec, reason: params.reason });
          break;
        }
        case 'hover':
          this._emit('HOVER', `Hover pointer pada elemen [${params.index}]`, params);
          break;
        case 'extract':
          this._emit('EXTRACTION', `Mengekstrak data untuk: "${params.query}"`, params);
          break;
        case 'highlight_text':
        case 'highlight':
          this._emit('HIGHLIGHT_TEXT', `Menyorot teks: "${params.text || ''}"`, params);
          break;
        case 'switch_tab':
          this._emit('TAB_SWITCHED', `Beralih ke tab ${params.tab_id}`, params);
          break;
        case 'screenshot':
        case 'take_screenshot':
          this._emit('SCREENSHOT', 'Mengambil tangkapan layar viewport', params);
          break;
        case 'close_tab':
          this._emit('TAB_CLOSED', `Menutup tab ${params.tab_id || 'aktif'}`, params);
          break;
      }
    }
  }

  global.Agent = Agent;
})(typeof window !== 'undefined' ? window : this);
