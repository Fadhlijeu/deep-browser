/**
 * Deep Browser Extension — Deterministic State Machine & Verification Reducer
 * ===========================================================================
 *
 * Implements strict authoritative state management:
 *   1. Run State Machine (idle, queued, running, waiting_for_approval, completed, failed, cancelled, interrupted, outcome_unknown)
 *   2. Tool-Call State Machine (pending, running, succeeded, failed, timed_out, cancelled, outcome_unknown)
 *   3. UI Action States (idle, submitting, accepted, rejected, timed_out, outcome_unknown)
 *   4. Safe Retry Classification (Class A read-only, Class B idempotent, Class C side-effecting)
 *   5. Recovery Protocol for Unknown Outcomes
 *   6. Event Deduplication & Correlation
 */

(function(global) {
  'use strict';

  // ─── Enumerations & Constants ───────────────────────────────────────────────
  const RUN_STATES = {
    IDLE: 'idle',
    QUEUED: 'queued',
    RUNNING: 'running',
    WAITING_FOR_APPROVAL: 'waiting_for_approval',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    INTERRUPTED: 'interrupted',
    OUTCOME_UNKNOWN: 'outcome_unknown',
  };

  const TERMINAL_RUN_STATES = new Set([
    RUN_STATES.COMPLETED,
    RUN_STATES.FAILED,
    RUN_STATES.CANCELLED,
  ]);

  const TOOL_STATES = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    TIMED_OUT: 'timed_out',
    CANCELLED: 'cancelled',
    OUTCOME_UNKNOWN: 'outcome_unknown',
  };

  const TERMINAL_TOOL_STATES = new Set([
    TOOL_STATES.SUCCEEDED,
    TOOL_STATES.FAILED,
    TOOL_STATES.TIMED_OUT,
    TOOL_STATES.CANCELLED,
  ]);

  const ACTION_STATES = {
    IDLE: 'idle',
    SUBMITTING: 'submitting',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    TIMED_OUT: 'timed_out',
    OUTCOME_UNKNOWN: 'outcome_unknown',
  };

  const RETRY_CLASSES = {
    CLASS_A: 'CLASS_A', // Read-only & repeatable (safe)
    CLASS_B: 'CLASS_B', // Idempotent mutations
    CLASS_C: 'CLASS_C', // Non-idempotent or uncertain side effects (requires confirmation)
  };

  // Presets definition
  const PRESETS = {
    DEFAULT: {
      id: 'default',
      name: 'Agent Decide',
      desc: 'Balanced autonomous reasoning with adaptive human verification.',
      icon: 'smart_toy',
      readOnly: false,
    },
    RESEARCH: {
      id: 'research',
      name: 'Research',
      desc: 'Deep multi-source web reading, synthesis & parallel extraction. Non-destructive.',
      icon: 'manage_search',
      readOnly: true,
    },
    DATA_EXTRACTION: {
      id: 'data_extraction',
      name: 'Data Extraction',
      desc: 'Structured schema, markdown & table scraping with strict read boundaries.',
      icon: 'dataset',
      readOnly: true,
    },
    FORM_FILLING: {
      id: 'form_filling',
      name: 'Form Filling',
      desc: 'Input fields & selectors guided by explicit verification before submit.',
      icon: 'edit_note',
      readOnly: false,
    },
    READ_ONLY: {
      id: 'read_only',
      name: 'Read-only Mode',
      desc: 'Strictly zero mutations or form inputs. Only navigation & extraction allowed.',
      icon: 'visibility',
      readOnly: true,
    },
  };

  // Allowed transitions table
  const ALLOWED_RUN_TRANSITIONS = {
    [RUN_STATES.IDLE]: new Set([RUN_STATES.QUEUED, RUN_STATES.FAILED]),
    [RUN_STATES.QUEUED]: new Set([RUN_STATES.RUNNING, RUN_STATES.FAILED, RUN_STATES.CANCELLED, RUN_STATES.INTERRUPTED]),
    [RUN_STATES.RUNNING]: new Set([RUN_STATES.WAITING_FOR_APPROVAL, RUN_STATES.COMPLETED, RUN_STATES.FAILED, RUN_STATES.CANCELLED, RUN_STATES.INTERRUPTED]),
    [RUN_STATES.WAITING_FOR_APPROVAL]: new Set([RUN_STATES.RUNNING, RUN_STATES.CANCELLED, RUN_STATES.FAILED, RUN_STATES.INTERRUPTED]),
    [RUN_STATES.INTERRUPTED]: new Set([RUN_STATES.RUNNING, RUN_STATES.WAITING_FOR_APPROVAL, RUN_STATES.COMPLETED, RUN_STATES.FAILED, RUN_STATES.CANCELLED, RUN_STATES.OUTCOME_UNKNOWN]),
    [RUN_STATES.OUTCOME_UNKNOWN]: new Set([RUN_STATES.RUNNING, RUN_STATES.WAITING_FOR_APPROVAL, RUN_STATES.COMPLETED, RUN_STATES.FAILED, RUN_STATES.CANCELLED]),
    [RUN_STATES.COMPLETED]: new Set(),
    [RUN_STATES.FAILED]: new Set(),
    [RUN_STATES.CANCELLED]: new Set(),
  };

  const ALLOWED_TOOL_TRANSITIONS = {
    [TOOL_STATES.PENDING]: new Set([TOOL_STATES.RUNNING, TOOL_STATES.CANCELLED, TOOL_STATES.FAILED]),
    [TOOL_STATES.RUNNING]: new Set([TOOL_STATES.SUCCEEDED, TOOL_STATES.FAILED, TOOL_STATES.TIMED_OUT, TOOL_STATES.CANCELLED, TOOL_STATES.OUTCOME_UNKNOWN]),
    [TOOL_STATES.OUTCOME_UNKNOWN]: new Set([TOOL_STATES.SUCCEEDED, TOOL_STATES.FAILED, TOOL_STATES.CANCELLED, TOOL_STATES.TIMED_OUT]),
    [TOOL_STATES.SUCCEEDED]: new Set(),
    [TOOL_STATES.FAILED]: new Set(),
    [TOOL_STATES.TIMED_OUT]: new Set(),
    [TOOL_STATES.CANCELLED]: new Set(),
  };

  // ─── Classification Helper ──────────────────────────────────────────────────
  function classifyAction(actionName, params = {}) {
    const readOnlyActions = new Set([
      'navigate',
      'scroll_page',
      'scroll_to_text',
      'hover',
      'wait',
      'extract',
      'switch_tab',
      'get_state',
      'take_screenshot',
      'save_as_pdf',
      'get_page_html',
      'get_chess_state',
      'done',
    ]);

    if (readOnlyActions.has(actionName)) {
      return RETRY_CLASSES.CLASS_A;
    }

    // Explicit idempotent mutations with provided keys or safe setters
    if (params && params.idempotency_key) {
      return RETRY_CLASSES.CLASS_B;
    }

    // Sensitive side-effects or mutations default to Class C
    return RETRY_CLASSES.CLASS_C;
  }

  // ─── Execution State Store ──────────────────────────────────────────────────
  class StateMachine {
    /**
     * @param {Object} options
     * @param {string} [options.runId]
     * @param {string} [options.preset]
     */
    constructor(options = {}) {
      this.runId = options.runId || null;
      this.runState = RUN_STATES.IDLE;
      this.preset = options.preset || 'default';
      this.startTime = null;
      this.endTime = null;
      this.error = null;
      this.finalResult = null;
      this.recoveryStatus = null; // null | 'reconciling' | 'unresolved' | 'recovered'

      // Tool calls keyed by toolCallId
      // { id, name, args, state, startTime, endTime, duration, attempts: [], verification: null, error: null }
      this.toolCalls = new Map();

      // Ordered timeline of authoritative events
      this.events = [];
      this.seenEventIds = new Set();

      // Pending approval if waiting_for_approval
      this.pendingApproval = null;

      // Action state (user click lifecycle)
      this.actionState = ACTION_STATES.IDLE;
      this.actionError = null;

      // Listeners
      this.subscribers = new Set();
    }

    subscribe(fn) {
      this.subscribers.add(fn);
      return () => this.subscribers.delete(fn);
    }

    _notify() {
      for (const fn of this.subscribers) {
        try { fn(this); } catch (e) { console.error('[StateMachine] subscriber error:', e); }
      }
    }

    /**
     * Initializes a brand new run. A new run must receive a new run ID and
     * never reuse previous run's timestamps or events.
     */
    startRun(runId, preset = null) {
      this.runId = runId || ('run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
      this.runState = RUN_STATES.QUEUED;
      if (preset && PRESETS[preset.toUpperCase()]) {
        this.preset = preset;
      }
      this.startTime = Date.now();
      this.endTime = null;
      this.error = null;
      this.finalResult = null;
      this.recoveryStatus = null;
      this.toolCalls.clear();
      this.events = [];
      this.seenEventIds.clear();
      this.pendingApproval = null;
      this.actionState = ACTION_STATES.IDLE;
      this.actionError = null;

      this.addEvent({
        id: `evt_start_${this.runId}`,
        runId: this.runId,
        type: 'RUN_QUEUED',
        timestamp: this.startTime,
        source: 'runtime',
        message: `Run queued with preset: ${this.preset}`,
      });

      this._notify();
      return this.runId;
    }

    /**
     * Transition the top-level run state strictly following rules.
     */
    transitionRun(nextState, context = {}) {
      if (this.runState === nextState) {
        // Idempotent duplicate event
        return true;
      }

      if (TERMINAL_RUN_STATES.has(this.runState)) {
        if (TERMINAL_RUN_STATES.has(nextState)) {
          // Late or conflicting terminal event: do not overwrite without reconciliation
          console.warn(`[StateMachine] Ignored terminal conflict: current=${this.runState}, incoming=${nextState}`);
          return false;
        }
        // Regression attempt from terminal state is invalid
        console.warn(`[StateMachine] Cannot regress from terminal state ${this.runState} to ${nextState}`);
        return false;
      }

      const allowed = ALLOWED_RUN_TRANSITIONS[this.runState];
      if (!allowed || !allowed.has(nextState)) {
        console.warn(`[StateMachine] Invalid run transition: ${this.runState} -> ${nextState}`);
        return false;
      }

      const prev = this.runState;
      this.runState = nextState;

      if (nextState === RUN_STATES.RUNNING && !this.startTime) {
        this.startTime = context.timestamp || Date.now();
      }

      if (TERMINAL_RUN_STATES.has(nextState)) {
        this.endTime = context.timestamp || Date.now();
        if (nextState === RUN_STATES.COMPLETED) {
          this.finalResult = context.result || null;
        } else if (nextState === RUN_STATES.FAILED) {
          this.error = context.error || null;
        }
      }

      if (nextState === RUN_STATES.WAITING_FOR_APPROVAL) {
        this.pendingApproval = context.approval || null;
      } else if (prev === RUN_STATES.WAITING_FOR_APPROVAL && nextState !== RUN_STATES.INTERRUPTED) {
        this.pendingApproval = null;
      }

      this._notify();
      return true;
    }

    /**
     * Registers or updates a tool call.
     */
    registerToolCall(toolCallId, name, args = {}) {
      if (!toolCallId) return null;
      let record = this.toolCalls.get(toolCallId);
      if (!record) {
        record = {
          id: toolCallId,
          name,
          args,
          state: TOOL_STATES.PENDING,
          startTime: null,
          endTime: null,
          duration: null,
          attempts: [{ attemptNumber: 1, state: TOOL_STATES.PENDING, startedAt: Date.now() }],
          verification: null,
          error: null,
          result: null,
          classification: classifyAction(name, args),
        };
        this.toolCalls.set(toolCallId, record);
        this._notify();
      }
      return record;
    }

    /**
     * Transition a tool call state strictly following transition table.
     */
    transitionTool(toolCallId, nextState, context = {}) {
      const record = this.toolCalls.get(toolCallId);
      if (!record) {
        // Create pending first if out-of-order execution arrived
        const created = this.registerToolCall(toolCallId, context.name || 'unknown_tool', context.args || {});
        if (!created) return false;
        return this.transitionTool(toolCallId, nextState, context);
      }

      if (record.state === nextState) return true;

      const allowed = ALLOWED_TOOL_TRANSITIONS[record.state];
      if (!allowed || !allowed.has(nextState)) {
        console.warn(`[StateMachine] Invalid tool transition for ${toolCallId}: ${record.state} -> ${nextState}`);
        return false;
      }

      record.state = nextState;

      const currentAttempt = record.attempts[record.attempts.length - 1];
      if (currentAttempt) {
        currentAttempt.state = nextState;
      }

      if (nextState === TOOL_STATES.RUNNING) {
        record.startTime = context.timestamp || Date.now();
        if (currentAttempt) currentAttempt.startedAt = record.startTime;
      }

      if (TERMINAL_TOOL_STATES.has(nextState)) {
        record.endTime = context.timestamp || Date.now();
        if (record.startTime) {
          record.duration = Math.max(0, record.endTime - record.startTime);
        }
        if (currentAttempt) {
          currentAttempt.finishedAt = record.endTime;
          currentAttempt.duration = record.duration;
        }

        if (nextState === TOOL_STATES.SUCCEEDED) {
          record.result = context.result !== undefined ? context.result : true;
          record.verification = context.verification || null;
        } else if (nextState === TOOL_STATES.FAILED || nextState === TOOL_STATES.TIMED_OUT) {
          record.error = context.error || (nextState === TOOL_STATES.TIMED_OUT ? 'Tool execution timed out' : 'Execution failed');
        }
      }

      this._notify();
      return true;
    }

    /**
     * Records a distinct retry attempt for an existing tool call.
     */
    retryToolAttempt(toolCallId) {
      const record = this.toolCalls.get(toolCallId);
      if (!record) return null;

      const attemptNum = record.attempts.length + 1;
      const newAttempt = {
        attemptNumber: attemptNum,
        state: TOOL_STATES.PENDING,
        startedAt: Date.now(),
        finishedAt: null,
        duration: null,
        error: null,
      };

      record.attempts.push(newAttempt);
      record.state = TOOL_STATES.PENDING;
      record.endTime = null;
      record.duration = null;
      record.error = null;

      this._notify();
      return newAttempt;
    }

    /**
     * Appends an authoritative event with stable ID and deduplication.
     */
    addEvent(event) {
      if (!event) return;
      const id = event.id || (`evt_${this.events.length + 1}_${Date.now()}`);
      if (this.seenEventIds.has(id)) {
        // Deduplicate repeated event
        return;
      }

      this.seenEventIds.add(id);
      const cleanEvent = {
        id,
        runId: event.runId || this.runId,
        toolCallId: event.toolCallId || null,
        type: event.type || 'INFO',
        timestamp: event.timestamp || Date.now(),
        duration: event.duration !== undefined ? event.duration : null,
        source: event.source || 'agent',
        status: event.status || null,
        message: event.message || '',
        args: event.args || null,
        result: event.result !== undefined ? event.result : null,
        verification: event.verification || null,
        error: event.error || null,
      };

      this.events.push(cleanEvent);
      this._notify();
      return cleanEvent;
    }

    /**
     * Handles UI action submission state transitions (Send, Stop, Retry, Approve, Reject).
     */
    setActionState(state, error = null) {
      this.actionState = state;
      this.actionError = error;
      this._notify();
    }

    /**
     * Reconciles unknown outcome or interrupted run with authoritative runtime snapshot.
     */
    reconcileWithRuntime(snapshot = {}) {
      if (!snapshot || !snapshot.runId || snapshot.runId !== this.runId) {
        console.warn('[StateMachine] Mismatched runId during reconciliation');
        return false;
      }

      const confirmedState = snapshot.runState;
      if (confirmedState && Object.values(RUN_STATES).includes(confirmedState)) {
        this.runState = confirmedState;
        this.recoveryStatus = 'recovered';
      } else {
        this.recoveryStatus = 'unresolved';
      }

      if (snapshot.finalResult !== undefined) {
        this.finalResult = snapshot.finalResult;
      }
      if (snapshot.error !== undefined) {
        this.error = snapshot.error;
      }

      if (Array.isArray(snapshot.events)) {
        for (const evt of snapshot.events) {
          this.addEvent(evt);
        }
      }

      this._notify();
      return true;
    }

    /**
     * Checks if a retry is eligible and safe.
     * Returns: { eligible: boolean, requiresConfirmation: boolean, reason: string, classification: string }
     */
    checkRetryEligibility(toolCallId = null) {
      if (toolCallId) {
        const tool = this.toolCalls.get(toolCallId);
        if (!tool) {
          return { eligible: false, requiresConfirmation: false, reason: 'Tool call not found', classification: null };
        }

        if (tool.state === TOOL_STATES.RUNNING || tool.state === TOOL_STATES.PENDING) {
          return { eligible: false, requiresConfirmation: false, reason: 'Operation is currently active', classification: tool.classification };
        }

        if (tool.state === TOOL_STATES.SUCCEEDED) {
          return { eligible: false, requiresConfirmation: false, reason: 'Operation already succeeded', classification: tool.classification };
        }

        const classification = tool.classification || RETRY_CLASSES.CLASS_C;

        if (tool.state === TOOL_STATES.OUTCOME_UNKNOWN) {
          if (classification === RETRY_CLASSES.CLASS_A) {
            return { eligible: true, requiresConfirmation: false, reason: 'Safe read-only retry', classification };
          }
          return {
            eligible: true,
            requiresConfirmation: true,
            reason: 'Outcome is unknown. Retrying a potentially side-effecting mutation could cause duplicates.',
            classification,
          };
        }

        if (classification === RETRY_CLASSES.CLASS_A || classification === RETRY_CLASSES.CLASS_B) {
          return { eligible: true, requiresConfirmation: false, reason: 'Safe retry eligible', classification };
        }

        // Class C failed or timed out
        return { eligible: true, requiresConfirmation: false, reason: 'Standard retry eligible', classification };
      }

      // Run-level retry
      if (this.runState === RUN_STATES.RUNNING || this.runState === RUN_STATES.QUEUED || this.runState === RUN_STATES.WAITING_FOR_APPROVAL) {
        return { eligible: false, requiresConfirmation: false, reason: 'Run is currently executing', classification: null };
      }

      if (this.runState === RUN_STATES.OUTCOME_UNKNOWN || this.runState === RUN_STATES.INTERRUPTED) {
        return {
          eligible: true,
          requiresConfirmation: true,
          reason: 'Run outcome is uncertain. Re-executing may duplicate browser actions.',
          classification: RETRY_CLASSES.CLASS_C,
        };
      }

      return { eligible: true, requiresConfirmation: false, reason: 'Ready to re-run', classification: RETRY_CLASSES.CLASS_A };
    }

    getSummary() {
      const elapsed = this.startTime
        ? Math.max(0, Math.round(((this.endTime || Date.now()) - this.startTime) / 1000))
        : 0;

      return {
        runId: this.runId,
        runState: this.runState,
        preset: this.preset,
        elapsedSeconds: elapsed,
        eventCount: this.events.length,
        toolCount: this.toolCalls.size,
        hasPendingApproval: !!this.pendingApproval,
        recoveryStatus: this.recoveryStatus,
      };
    }
  }

  // Export for browser & node test environments
  const exportsObj = {
    RUN_STATES,
    TERMINAL_RUN_STATES,
    TOOL_STATES,
    TERMINAL_TOOL_STATES,
    ACTION_STATES,
    RETRY_CLASSES,
    PRESETS,
    classifyAction,
    StateMachine,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
  if (typeof window !== 'undefined') {
    window.DeepBrowserState = exportsObj;
  }
})(typeof window !== 'undefined' ? window : global);
