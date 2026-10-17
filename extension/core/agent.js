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

      // Priority 1 from browser_use legacy: ActionLoopDetector & UrlShortener
      const LoopDetectorCls = (typeof window !== 'undefined' && window.ActionLoopDetector) || (typeof global !== 'undefined' && global.ActionLoopDetector) || (typeof ActionLoopDetector !== 'undefined' ? ActionLoopDetector : null);
      this.loopDetector = LoopDetectorCls ? new LoopDetectorCls() : null;

      const UrlShortenerCls = (typeof window !== 'undefined' && window.UrlShortener) || (typeof global !== 'undefined' && global.UrlShortener) || (typeof UrlShortener !== 'undefined' ? UrlShortener : null);
      this.urlShortener = UrlShortenerCls ? new UrlShortenerCls() : null;

      // Priority 2 from browser_use legacy: Multi-Action and Plan State Machine
      this.enablePlanning = options.enablePlanning !== false;
      this.planningReplanOnStall = options.planningReplanOnStall ?? 3;
      this.planningExplorationLimit = options.planningExplorationLimit ?? 5;
      this.plan = null;
      this.currentPlanItemIndex = 0;
      this.planGenerationStep = null;
      this.consecutiveActionFailures = 0;

      // Priority 3 from browser_use legacy: Fallback LLM, History Rerun & Trace Judge
      this.fallbackLlmClient = options.fallbackLlmClient || null;
      this.isUsingFallbackLlm = false;
      const JudgeCls = (typeof window !== 'undefined' && window.Judge) || (typeof global !== 'undefined' && global.Judge) || (typeof Judge !== 'undefined' ? Judge : null);
      this.judge = options.judge || (JudgeCls ? new JudgeCls({ llmClient: options.judgeLlmClient || this.llmClient }) : null);
      this.useJudge = options.useJudge === true;
      this.groundTruth = options.groundTruth || null;
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
        taskId: this.taskId,
        tabId: this.browserSession?.tabId,
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
      if (this.llmClient && typeof this.llmClient.abort === 'function') {
        try { this.llmClient.abort(); } catch (_) {}
      }
      if (this.browserSession) {
        try { this.browserSession.clearInPageHighlights(); } catch (_) {}
      }
      if (this.interactionManager) {
        try {
          this.interactionManager.cancelInteraction(null, 'Agent dihentikan oleh pengguna');
        } catch {}
      }
      this._emit('TASK_CANCELLED', 'Agent dihentikan oleh pengguna');
    }

    /**
     * Updates plan state from model output (plan_update, current_plan_item).
     * @param {Object} decision
     */
    _updatePlanFromModelOutput(decision) {
      if (!this.enablePlanning || !decision) return;

      // If model provided a new plan via plan_update, initialize/replace plan
      if (Array.isArray(decision.plan_update) && decision.plan_update.length > 0) {
        this.plan = decision.plan_update.map(stepText => ({
          text: String(stepText),
          status: 'pending',
        }));
        this.currentPlanItemIndex = 0;
        this.planGenerationStep = this.step;
        if (this.plan.length > 0) {
          this.plan[0].status = 'current';
        }
        this._emit('PLAN_UPDATED', `Rencana kerja diperbarui (${this.plan.length} butir langkah)`, {
          plan: this.plan,
          generationStep: this.step,
        });
        return;
      }

      // If model provided current_plan_item index, advance the plan
      if (typeof decision.current_plan_item === 'number' && Array.isArray(this.plan) && this.plan.length > 0) {
        let newIdx = decision.current_plan_item;
        newIdx = Math.max(0, Math.min(newIdx, this.plan.length - 1));

        // Mark steps prior to new as done
        for (let i = 0; i < newIdx; i++) {
          if (this.plan[i] && (this.plan[i].status === 'current' || this.plan[i].status === 'pending')) {
            this.plan[i].status = 'done';
          }
        }

        // Mark target step as current
        if (this.plan[newIdx]) {
          this.plan[newIdx].status = 'current';
        }

        this.currentPlanItemIndex = newIdx;
        this._emit('PLAN_PROGRESS', `Kemajuan rencana: langkah [${newIdx + 1}/${this.plan.length}] aktif`, {
          currentPlanItemIndex: newIdx,
          plan: this.plan,
        });
      }
    }

    /**
     * Renders the current plan with status markers [x], [>], [ ], [-].
     * @returns {string|null}
     */
    _renderPlanDescription() {
      if (!this.enablePlanning || !Array.isArray(this.plan) || this.plan.length === 0) {
        return null;
      }
      const markers = { done: '[x]', current: '[>]', pending: '[ ]', skipped: '[-]' };
      return this.plan.map((item, idx) => {
        const marker = markers[item.status] || '[ ]';
        return `${marker} ${idx}: ${item.text}`;
      }).join('\n');
    }

    /**
     * Injects a replan nudge when stall detection threshold is met,
     * or an exploration nudge if agent took many steps without planning.
     * @returns {string|null}
     */
    _getPlanNudge() {
      if (!this.enablePlanning) return null;

      // Replan nudge on consecutive failures
      if (this.plan && this.planningReplanOnStall > 0 && this.consecutiveActionFailures >= this.planningReplanOnStall) {
        return `REPLAN SUGGESTED: You have failed ${this.consecutiveActionFailures} consecutive times. Your current plan may need revision. Output a new \`plan_update\` with revised steps to recover.`;
      }

      // Exploration nudge: steps without a plan
      if (!this.plan && this.planningExplorationLimit > 0 && this.step >= this.planningExplorationLimit) {
        return `PLANNING NUDGE: You have taken ${this.step} steps without creating a plan. If the task is complex, output a \`plan_update\` with clear todo items now. If the task is already done, call \`done\` instead.`;
      }

      return null;
    }

    /**
     * Executes multiple actions sequentially with page-change guards (browser-use legacy adoption).
     * @param {Array<{action_name: string, parameters: Object}>} actions
     * @returns {Promise<Array<Object>>} Action results
     */
    
    /**
     * Attempts to switch to fallback LLM on rate limits, quota exhaustion, or server errors.
     * @param {Error} error
     * @returns {boolean} True if successfully switched
     */
    _trySwitchToFallbackLlm(error) {
      if (this.isUsingFallbackLlm || !this.fallbackLlmClient) {
        return false;
      }

      const retryableStatusCodes = [401, 402, 429, 500, 502, 503, 504];
      const errMsg = String(error.message || '');
      const isRateLimit = (
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('resource_exhausted')
      );
      const hasRetryableStatus = error.status && retryableStatusCodes.includes(error.status);

      if (!isRateLimit && !hasRetryableStatus) {
        return false;
      }

      this._originalLlmClient = this.llmClient;
      this.llmClient = this.fallbackLlmClient;
      this.isUsingFallbackLlm = true;
      return true;
    }

    /**
     * Reruns a saved history of actions deterministically with retry logic and pacing (browser-use legacy adoption).
     * @param {Array<Object>} history - Array of step items with action definitions
     * @param {Object} [options]
     * @param {number} [options.maxRetries=2] - Max retries per action
     * @param {boolean} [options.skipFailures=false] - Whether to continue if an action fails
     * @param {number} [options.delayBetweenActions=1.0] - Delay in seconds between actions
     * @returns {Promise<Object>} Execution summary
     */
    async rerunHistory(history = [], options = {}) {
      if (!Array.isArray(history) || history.length === 0) {
        return { success: false, error: 'History trace is empty or invalid' };
      }

      const maxRetries = options.maxRetries ?? 2;
      const skipFailures = options.skipFailures ?? false;
      const delayBetweenActions = options.delayBetweenActions ?? 1.0;

      this.isRunning = true;
      this.isStopped = false;
      this._emit('TASK_STARTED', `Memulai pemutaran ulang ${history.length} langkah history deterministik...`);

      const results = [];

      for (let i = 0; i < history.length; i++) {
        if (this.isStopped) {
          return { success: false, error: 'Rerun stopped by user', completedSteps: i };
        }

        const stepItem = history[i];
        const actionObj = stepItem.action || {};
        const actionName = actionObj.name || actionObj.action_name || stepItem.name || 'unknown';
        const params = actionObj.parameters || stepItem.parameters || {};

        if (i > 0 && delayBetweenActions > 0) {
          await this.browserSession.wait(delayBetweenActions);
          if (this.isStopped) break;
        }

        this._emit('RERUN_STEP', `[Replay Langkah ${i + 1}/${history.length}] Menjalankan: ${actionName}`, {
          stepIndex: i + 1,
          totalSteps: history.length,
          action_name: actionName,
          parameters: params,
        });

        let actionRes = null;
        let attempt = 0;

        while (attempt <= maxRetries) {
          attempt++;
          actionRes = await this.tools.execute(actionName, params);
          if (actionRes.success || attempt > maxRetries) break;

          this._emit('RETRY', `Aksi "${actionName}" gagal (percobaan ${attempt}/${maxRetries}): ${actionRes.error}. Mencoba ulang...`, {
            action_name: actionName,
            attempt,
          });
          await this.browserSession.wait(0.8);
        }

        results.push(actionRes);

        if (!actionRes.success) {
          this._emit('ACTION_FAILED', `Gagal menjalankan langkah replay [${i + 1}]: ${actionRes.error}`);
          if (!skipFailures) {
            this.isRunning = false;
            return {
              success: false,
              error: `Replay failed at step ${i + 1}: ${actionRes.error}`,
              failedStep: i + 1,
              completedSteps: i,
              results,
            };
          }
        } else {
          this._emit('ACTION_EXECUTED', `Berhasil menjalankan replay langkah [${i + 1}]: ${actionName}`);
        }

        if (actionName === 'done' || actionRes.data?.is_done) {
          const completionText = actionRes.data?.text || params.text || 'Replay history selesai.';
          this.isRunning = false;
          this._emit('TASK_COMPLETED', completionText, { success: true, completedSteps: i + 1 });
          return {
            success: true,
            result: completionText,
            completedSteps: i + 1,
            results,
          };
        }
      }

      this.isRunning = false;
      const doneMsg = `Replay history selesai (${results.length} langkah dieksekusi).`;
      this._emit('TASK_COMPLETED', doneMsg, { success: true, completedSteps: results.length });
      return {
        success: true,
        result: doneMsg,
        completedSteps: results.length,
        results,
      };
    }

    /**
     * Evaluates the completed agent trace with an independent Judge LLM.
     * @param {Object} [options]
     * @param {string} [options.groundTruth]
     * @returns {Promise<Object>} JudgementResult
     */
    async judgeTrace(options = {}) {
      const JudgeCls = (typeof window !== 'undefined' && window.Judge) || (typeof global !== 'undefined' && global.Judge) || (typeof Judge !== 'undefined' ? Judge : null);
      if (!this.judge && JudgeCls) {
        this.judge = new JudgeCls({ llmClient: options.judgeLlmClient || this.llmClient });
      }

      if (!this.judge) {
        return { verdict: true, reasoning: 'Judge module not available, defaulting to true' };
      }

      this._emit('JUDGE_STARTED', 'Memulai evaluasi independen trace oleh AI Judge...');

      const lastHistoryItem = this.messageManager.history[this.messageManager.history.length - 1];
      const finalResult = lastHistoryItem?.action?.parameters?.text || lastHistoryItem?.result?.message || 'Task completed.';
      let screenshotBase64 = null;
      try {
        const state = await this.browserSession.getState(false);
        screenshotBase64 = state.screenshot || null;
      } catch (_) {}

      const judgement = await this.judge.evaluateTrace({
        task: this.task,
        finalResult,
        history: this.messageManager.history,
        screenshotBase64,
        groundTruth: options.groundTruth || this.groundTruth,
        llmClient: options.judgeLlmClient || this.llmClient,
      });

      this._emit('TRACE_JUDGED', `Hasil evaluasi Judge: ${judgement.verdict ? 'VALID (BERHASIL)' : 'INVALID (BELUM MEMENUHI)'} — ${judgement.reasoning}`, judgement);

      return judgement;
    }

    async multiAct(actions) {
      const results = [];
      const totalActions = (actions || []).length;
      if (totalActions === 0) return results;

      for (let i = 0; i < totalActions; i++) {
        if (this.isStopped) break;

        const actionObj = actions[i];
        const actionName = actionObj.action_name;
        let params = actionObj.parameters || {};

        if (this.urlShortener && params) {
          params = this.urlShortener.restoreParams(params);
        }

        // Guard 1: ONLY ALLOW TO CALL `done` IF IT IS A SINGLE ACTION
        if (i > 0 && (actionName === 'done' || params.is_done)) {
          const skipMsg = `Aksi 'done' hanya diizinkan sebagai aksi tunggal — batch dihentikan setelah aksi ${i} / ${totalActions}.`;
          this._emit('OBSERVATION', skipMsg, { stoppedAt: i, totalActions });
          break;
        }

        // Guard 2: Short wait between actions (only after first action)
        if (i > 0) {
          await this.browserSession.wait(0.35);
          if (this.isStopped) break;
        }

        // Capture pre-action URL
        const preActionUrl = (await this.browserSession.getCurrentUrl?.()) || '';

        // Execute via Tools
        const res = await this.tools.execute(actionName, params);
        results.push(res);

        // Record action to loop detector
        if (this.loopDetector) {
          this.loopDetector.recordAction(actionName, params);
        }

        // If action failed or marks task done, stop remaining actions
        if (!res.success || res.data?.is_done || actionName === 'done' || i === totalActions - 1) {
          break;
        }

        // Guard 3: Static flag — actions that terminate sequence
        const terminatesSequence = ['navigate', 'refresh', 'switch_tab', 'open_tab', 'close_tab', 'go_back', 'parallel_research'].includes(actionName);
        if (terminatesSequence) {
          this._emit('OBSERVATION', `Aksi "${actionName}" memicu perubahan navigasi/halaman — melewati ${totalActions - i - 1} aksi berikutnya untuk memindai DOM baru.`, {
            action: actionName,
            skippedCount: totalActions - i - 1,
          });
          break;
        }

        // Guard 4: Runtime URL change detection
        const postActionUrl = (await this.browserSession.getCurrentUrl?.()) || '';
        if (postActionUrl && postActionUrl !== preActionUrl) {
          this._emit('OBSERVATION', `URL berubah dari "${preActionUrl}" ke "${postActionUrl}" setelah "${actionName}" — melewati ${totalActions - i - 1} aksi tersisa untuk observasi DOM segar.`, {
            action: actionName,
            oldUrl: preActionUrl,
            newUrl: postActionUrl,
            skippedCount: totalActions - i - 1,
          });
          break;
        }
      }

      return results;
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
          let state = await this.browserSession.getState(true);
          if (this.isStopped) break;

          const currentUrl = state.url || '';
          if (currentUrl !== lastPageUrl) {
            lastPageUrl = currentUrl;
            consecutiveScrollCount = 0;
            reachedBottomOnPage = false;
            reachedTopOnPage = false;

            // WAJIBKAN scroll setiap kali website mendapat informasi baru (saat terbuka, refresh, etc)
            if (!currentUrl.startsWith('chrome://') && !currentUrl.startsWith('edge://') && !currentUrl.startsWith('about:') && !currentUrl.startsWith('chrome-extension://')) {
              this._emit('OBSERVATION', `[Auto-Scan] Halaman baru terdeteksi: "${state.title || currentUrl}". Melakukan auto-scroll menyeluruh untuk menangkap konteks DOM dan screenshot...`, { url: currentUrl });
              await this.browserSession.autoScrollScanPage(async (info) => {
                if (this.isStopped) return;
                if (info.screenshot) {
                  this._emit('SCREENSHOT', `Tangkapan layar viewport (pemindaian auto-scroll ${info.percentage}%)`, {
                    screenshot: info.screenshot,
                    scroll_percentage: info.percentage,
                  });
                }
              });
              if (this.isStopped) break;
              // Refresh state so DOM elements and outline reflect the complete page after settling at top
              state = await this.browserSession.getState(true);
            }
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

          // ActionLoopDetector: Record page state for stagnation detection
          if (this.loopDetector) {
            this.loopDetector.recordPageState(state.url, state.simplifiedTreeText || '', state.elements?.length || 0);
          }

          // Anti-loop trigger: If agent has already scanned both top and bottom of this page,
          // and has scrolled 3 or more times consecutively without any other productive action
          const isStuckOscillating = consecutiveScrollCount >= 3 && reachedBottomOnPage && reachedTopOnPage;
          if (isStuckOscillating) {
            this._emit('LOOP_DETECTED', `Deteksi looping terpicu: agen telah menjelajahi seluruh halaman bolak-balik tanpa menemukan konten target. Mengarahkan agen untuk pivot atau terminasi...`, { url: currentUrl });
          }

          // ActionLoopDetector nudge (escalating awareness for repetition and page stagnation)
          const loopNudge = this.loopDetector ? this.loopDetector.getNudgeMessage() : null;
          if (loopNudge) {
            this._emit('LOOP_DETECTED', `Deteksi repetisi/stagnasi terpicu: ${loopNudge.slice(0, 100)}...`, {
              nudge: loopNudge,
              repetitionCount: this.loopDetector.maxRepetitionCount,
              stagnantPages: this.loopDetector.consecutiveStagnantPages,
            });
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
          const planDescription = this._renderPlanDescription();
          const replanNudge = this._getPlanNudge();

          const stepPayload = this.messageManager.buildStepPrompt(state, this.step, {
            isStuckOscillating,
            loopNudge,
            planDescription,
            replanNudge,
          });
          if (this.isStopped) break;

          // URL Shortener: Compress tracking and bloated URLs in prompt text to save token context
          if (this.urlShortener && stepPayload.textPrompt) {
            const { shortenedText, count } = this.urlShortener.shortenText(stepPayload.textPrompt);
            if (count > 0) {
              stepPayload.textPrompt = shortenedText;
            }
          }

          // ─── 3. PLANNING ────────────────────────────────────────────────────────
          this._emit('PLAN', `[Langkah ${this.step}] Merencanakan langkah berikutnya...`, { step: this.step });

          let decision;
          try {
            decision = await this.llmClient.planNextStep(systemPrompt, stepPayload);
          } catch (llmErr) {
            if (this.isStopped || llmErr.name === 'AbortError') {
              return { success: false, error: 'Agent stopped by user' };
            }

            // Fallback LLM Switch (browser-use legacy adoption)
            if (this._trySwitchToFallbackLlm(llmErr)) {
              this._emit('FALLBACK_LLM_SWITCHED', `LLM primer mengalami kendala (${llmErr.message}). Otomatis beralih ke Fallback LLM (${this.llmClient.model || this.llmClient.provider})...`, {
                originalError: llmErr.message,
                status: llmErr.status,
                fallbackModel: this.llmClient.model,
                fallbackProvider: this.llmClient.provider,
              });
              try {
                decision = await this.llmClient.planNextStep(systemPrompt, stepPayload);
              } catch (fallbackErr) {
                if (this.isStopped || fallbackErr.name === 'AbortError') {
                  return { success: false, error: 'Agent stopped by user' };
                }
                throw new Error(`Fallback LLM Error: ${fallbackErr.message}`);
              }
            } else {
              throw new Error(`LLM Error: ${llmErr.message}`);
            }
          }

          if (this.isStopped) break;

          // Priority 2: Update Plan State Machine from model output
          this._updatePlanFromModelOutput(decision);

          // URL Shortener: Restore any shortened URLs passed in decision parameters
          if (this.urlShortener && decision.parameters) {
            decision.parameters = this.urlShortener.restoreParams(decision.parameters);
          }

          if (decision.thinking) {
            this._emit('REASONING', decision.thinking, {
              step: this.step,
              thinking: decision.thinking,
            });
          }

          // Priority 2: Multi-Action Batch Preparation
          let actionsToExecute = [];
          if (Array.isArray(decision.actions) && decision.actions.length > 0) {
            actionsToExecute = decision.actions;
          } else if (decision.action_name) {
            actionsToExecute = [{
              action_name: decision.action_name,
              parameters: decision.parameters || {},
            }];
          }

          let batchTerminalResult = null;

          for (let actIdx = 0; actIdx < actionsToExecute.length; actIdx++) {
            if (this.isStopped) break;

            const currentAction = actionsToExecute[actIdx];
            const actionName = currentAction.action_name;
            let params = currentAction.parameters || {};

            if (this.urlShortener && params) {
              params = this.urlShortener.restoreParams(params);
              currentAction.parameters = params;
            }

            // Guard 1: ONLY ALLOW `done` IF IT IS A SINGLE ACTION
            if (actIdx > 0 && (actionName === 'done' || params.is_done)) {
              this._emit('OBSERVATION', `Aksi 'done' hanya diizinkan sebagai aksi tunggal — batch dihentikan setelah sub-aksi ${actIdx} / ${actionsToExecute.length}.`);
              break;
            }

            // Guard 2: Pacing between actions in multi-act batch
            if (actIdx > 0) {
              await this.browserSession.wait(0.35);
              if (this.isStopped) break;
            }

            if (actionsToExecute.length > 1) {
              this._emit('MULTI_ACTION_STEP', `[Sub-aksi ${actIdx + 1}/${actionsToExecute.length}] Menjalankan: ${actionName}`, {
                index: actIdx + 1,
                total: actionsToExecute.length,
                action_name: actionName,
                parameters: params,
              });
            }

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
              break;
            }

            const requiresHumanReview = (
              this.mode === 'hitl' ||
              (this.securityPolicy && (
                (typeof this.securityPolicy.isHighRisk === 'function' && this.securityPolicy.isHighRisk(actionName, params)) ||
                (this.mode !== 'auto' && this.securityPolicy.requiresReview(actionName, params))
              ))
            );

            if (requiresHumanReview) {
              const proposalId = 'prop_' + Date.now().toString(36) + '_' + this.step + '_' + actIdx;
              this._emit('ACTION_PROPOSED', `Proposal Aksi: ${actionName}`, { action_name: actionName, parameters: params, proposal_id: proposalId });
              this._emit('USER_APPROVAL_REQUIRED', `Menunggu persetujuan untuk aksi: ${actionName}`, {
                action_name: actionName,
                parameters: params,
                proposal_id: proposalId,
              });

              const approvalResult = await this.interactionManager.requestInteraction({
                type: 'approval',
                question: `Konfirmasi aksi: ${actionName}`,
                action_name: actionName,
                parameters: params,
                proposal_id: proposalId,
              });

              if (approvalResult.action_name && approvalResult.action_name !== actionName) {
                const mismatchMsg = `Persetujuan tidak cocok (proposal: ${actionName}, respon: ${approvalResult.action_name}).`;
                this._emit('ACTION_FAILED', mismatchMsg, { error: mismatchMsg });
                break;
              }

              if (!approvalResult.approved && approvalResult.value === 'reject') {
                const feedback = approvalResult.feedback || 'User rejected the action.';
                this._emit('RETRY', `Aksi ditolak: ${feedback}. Merencanakan ulang...`, { feedback });
                this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: `Rejected by user: ${feedback}` });
                break;
              } else if (approvalResult.value === 'edit') {
                const feedback = approvalResult.feedback || 'User requested modification.';
                this._emit('RETRY', `Instruksi diubah: ${feedback}. Merencanakan ulang...`, { feedback });
                this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: `Modified by user: ${feedback}` });
                break;
              }
            }

            if (this.securityPolicy && typeof this.securityPolicy.isActionAllowed === 'function') {
              if (!this.securityPolicy.isActionAllowed(actionName, params)) {
                const blockedMsg = `Aksi "${actionName}" tidak diizinkan oleh kebijakan preset aktif: ${this.preset}`;
                this._emit('ACTION_FAILED', blockedMsg, { error: blockedMsg, action_name: actionName, preset: this.preset });
                this.messageManager.recordStep(this.step, decision.thinking, { name: actionName, parameters: params }, { success: false, error: blockedMsg });
                break;
              }
            }

            // Anti-loop duplicate click guard
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
                break;
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
            const preActionUrl = (state.url || '');
            const actionResult = await this.tools.execute(actionName, params);
            if (this.isStopped) break;

            if (!actionResult.success) {
              this.consecutiveActionFailures++;
              this._emit('ACTION_FAILED', `Gagal: ${actionResult.error}`, { error: actionResult.error });
            } else {
              this.consecutiveActionFailures = 0;
              this._emit('ACTION_EXECUTED', actionResult.message || `Aksi ${actionName} dieksekusi`, { data: actionResult.data });

              if (actionName === 'parallel_research') {
                const report = actionResult.data?.synthesizedReport || actionResult.message;
                this.isRunning = false;
                this._emit('TASK_COMPLETED', report, {
                  result: report,
                  totalSteps: this.step,
                  success: true,
                });
                batchTerminalResult = { success: true, result: report, totalSteps: this.step };
                break;
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
                  batchTerminalResult = { success: true, result: finalAnswer, totalSteps: this.step };
                  break;
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
            } else if (['highlight_text', 'highlight_sections', 'click_element', 'input_text', 'navigate', 'refresh', 'parallel_research'].includes(actionName)) {
              consecutiveScrollCount = 0;
              if (actionName === 'refresh') {
                lastPageUrl = null;
              }
            }

            // ActionLoopDetector: Record action into rolling window for repetition analysis
            if (this.loopDetector) {
              this.loopDetector.recordAction(actionName, params);
            }

            // ─── 7. DETERMINISTIC VERIFICATION ──────────────────────────────────────
            const verification = await this._verifyAction(actionName, params, preActionUrl, actionResult);
            this._emit('VERIFICATION', verification.message, {
              verified: verification.verified,
              outcome: verification.outcome || (verification.verified ? 'verified' : 'failed'),
              error: verification.error,
            });

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
              batchTerminalResult = {
                success: true,
                result: finalAnswer,
                totalSteps: this.step,
              };
              break;
            }

            // If action or verification failed, abort remaining actions in batch
            if (!actionResult.success || !verification.verified) {
              if (actIdx < actionsToExecute.length - 1) {
                this._emit('OBSERVATION', `Aksi "${actionName}" gagal atau tidak terverifikasi — melewati ${actionsToExecute.length - actIdx - 1} aksi berikutnya dalam batch untuk observasi ulang.`, {
                  failedAction: actionName,
                  skippedCount: actionsToExecute.length - actIdx - 1,
                });
              }
              break;
            }

            // --- PAGE-CHANGE GUARDS (only when more actions remain in batch) ---
            if (actIdx < actionsToExecute.length - 1) {
              // Layer 1: Static flag — action terminates sequence
              const terminatesSequence = ['navigate', 'refresh', 'switch_tab', 'open_tab', 'close_tab', 'go_back', 'parallel_research'].includes(actionName);
              if (terminatesSequence) {
                this._emit('OBSERVATION', `Aksi "${actionName}" memicu perpindahan navigasi/halaman — melewati ${actionsToExecute.length - actIdx - 1} aksi berikutnya untuk memindai DOM baru.`, {
                  action: actionName,
                  skippedCount: actionsToExecute.length - actIdx - 1,
                });
                break;
              }

              // Layer 2: Runtime detection — URL changed
              try {
                const currentPostUrl = (await this.browserSession.getCurrentUrl?.()) || '';
                if (currentPostUrl && currentPostUrl !== preActionUrl) {
                  this._emit('OBSERVATION', `URL berubah dari "${preActionUrl}" ke "${currentPostUrl}" setelah "${actionName}" — melewati ${actionsToExecute.length - actIdx - 1} aksi tersisa untuk observasi DOM segar.`, {
                    action: actionName,
                    oldUrl: preActionUrl,
                    newUrl: currentPostUrl,
                    skippedCount: actionsToExecute.length - actIdx - 1,
                  });
                  break;
                }
              } catch (postUrlErr) {
                console.warn('[Agent] Error checking post-action URL guard:', postUrlErr);
              }
            }
          } // end of actionsToExecute loop

          if (batchTerminalResult) {
            return batchTerminalResult;
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
        if (this.isStopped || err.name === 'AbortError') {
          return { success: false, error: 'Agent stopped by user' };
        }
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
     * Deterministic action verification with actual evidence checks.
     */
    async _verifyAction(actionName, params, preUrl, actionResult) {
      if (!actionResult || !actionResult.success) {
        return {
          verified: false,
          outcome: 'failed',
          message: `Aksi ${actionName} gagal dieksekusi: ${actionResult?.error || 'Unknown error'}`,
          error: actionResult?.error,
        };
      }

      switch (actionName) {
        case 'navigate': {
          const target = params.url || '';
          try {
            const currentTab = await this.browserSession.getActiveTab();
            const currentUrl = currentTab?.url || '';
            const isTargetMatch = currentUrl.includes(target) || (target.includes(currentUrl) && currentUrl.length > 10);
            const isUrlChanged = preUrl && currentUrl !== preUrl;
            if (isTargetMatch || isUrlChanged) {
              return {
                verified: true,
                outcome: 'verified',
                message: `Navigasi ke ${target} diverifikasi (URL aktif: ${currentUrl}).`,
              };
            }
            return {
              verified: false,
              outcome: 'outcome_unknown',
              message: `Navigasi dikirim tetapi URL belum berubah dari ${preUrl}.`,
            };
          } catch (_) {
            return {
              verified: true,
              outcome: 'executed',
              message: `Navigasi ke ${target} telah dieksekusi.`,
            };
          }
        }
        case 'click_element': {
          const tag = actionResult.data?.tagName ? ` (<${actionResult.data.tagName.toLowerCase()}>)` : '';
          const hasHref = actionResult.data?.href;
          if (actionResult.data?.success) {
            return {
              verified: true,
              outcome: 'verified',
              message: `Klik elemen [${params.index}]${tag} berhasil diverifikasi${hasHref ? ` (href: ${hasHref})` : ''}.`,
            };
          }
          return {
            verified: true,
            outcome: 'outcome_unknown',
            message: `Klik elemen [${params.index}] dikirim tanpa konfirmasi perubahan DOM.`,
          };
        }
        case 'input_text': {
          const val = actionResult.data?.currentValue;
          if (typeof val === 'string') {
            const match = val.includes(params.text);
            return {
              verified: match,
              outcome: match ? 'verified' : 'failed',
              message: match
                ? `Teks "${params.text}" berhasil diinput dan diverifikasi pada nilai elemen input.`
                : `Nilai input tidak sesuai (saat ini: "${val}").`,
            };
          }
          return {
            verified: true,
            outcome: 'outcome_unknown',
            message: `Input teks "${params.text}" dieksekusi.`,
          };
        }
        case 'scroll_page': {
          return {
            verified: true,
            outcome: 'verified',
            message: 'Posisi scroll halaman telah diperbarui.',
          };
        }
        case 'highlight_sections': {
          const count = actionResult.data?.highlightedCount ?? (Array.isArray(actionResult.data?.results) ? actionResult.data.results.filter(r => r.found).length : 0);
          if (count > 0) {
            return {
              verified: true,
              outcome: 'verified',
              message: `${count} bagian konten substantif berhasil disorot dengan Color Theory.`,
            };
          }
          return {
            verified: false,
            outcome: 'failed',
            message: 'Tidak ada bagian konten yang berhasil disorot pada halaman ini.',
          };
        }
        case 'highlight_text':
        case 'highlight': {
          const found = actionResult.data?.found !== false;
          if (found) {
            return {
              verified: true,
              outcome: 'verified',
              message: 'Teks narasi penjelasan berhasil disorot pada halaman.',
            };
          }
          return {
            verified: false,
            outcome: 'failed',
            message: 'Teks target tidak ditemukan pada halaman untuk disorot.',
          };
        }
        case 'wait': {
          const sec = params.seconds || 3;
          return {
            verified: true,
            outcome: 'verified',
            message: `Proses waiting ${sec} detik selesai, DOM siap dievaluasi kembali.`,
          };
        }
        case 'done': {
          return {
            verified: true,
            outcome: 'verified',
            message: 'Tugas ditandai selesai.',
          };
        }
        default:
          return {
            verified: true,
            outcome: 'executed',
            message: `Aksi ${actionName} selesai dieksekusi.`,
          };
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
        case 'highlight_sections': {
          const list = params.sections || params.topics || params.items || [];
          const count = list.length;
          const names = list.map(s => typeof s === 'string' ? s : (s.topic || s.name || s.title)).filter(Boolean).join(', ');
          this._emit('HIGHLIGHT_SECTIONS', `Menyorot ${count} bagian konten (${names || 'multi-topik'}) dengan penjelasan substantif`, params);
          break;
        }
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
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
