/**
 * Deep Browser Extension — Interaction Runtime & State Machine
 * =============================================================
 *
 * Implements the Human-in-the-Loop (HITL) Execution Primitive:
 *   - Explicit State Machine: IDLE → RUNNING → WAITING_FOR_USER → USER_RESPONDED → RUNNING → DONE / CANCELLED
 *   - Atomic Transition: PENDING → RESOLVED (prevents rapid double-click race conditions)
 *   - Structured Interaction Object with interaction_id (UUID)
 *   - Zero busy-polling (Promise-based suspension & event resumption)
 *   - Idempotency hashing to prevent duplicate widget generation
 *   - Persistence & Hydration across SidePanel/Compact UI reopen
 *   - 8 Supported Widget Primitives:
 *       1. choice
 *       2. multi_choice
 *       3. confirm
 *       4. text_input
 *       5. number_input
 *       6. file_picker
 *       7. approval (Approve / Reject / Edit)
 *       8. waiting (Manual CAPTCHA / User confirmation)
 */

(function(global) {
  'use strict';

  // State Machine Constants
  const TaskState = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    WAITING_FOR_USER: 'WAITING_FOR_USER',
    USER_RESPONDED: 'USER_RESPONDED',
    DONE: 'DONE',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
  };

  const InteractionStatus = {
    PENDING: 'pending',
    RESOLVED: 'resolved',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
  };

  class InteractionManager {
    constructor(options = {}) {
      this.taskId = options.taskId || 'task_' + Date.now().toString(36);
      this.state = TaskState.IDLE;
      this.activeInteraction = null;
      this._pendingResolvers = new Map(); // interaction_id -> { resolve, reject }
      this._seenHashes = new Set();
      this.onStateChange = options.onStateChange || (() => {});
      this.onInteractionEvent = options.onInteractionEvent || (() => {});
      this.storageKey = `deep_browser_interaction_${this.taskId}`;

      this._initHydration();
    }

    /**
     * Generates a collision-resistant UUID for interactions.
     */
    static generateId() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'ix_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Computes a quick hash for idempotency checking.
     */
    static hashPayload(type, question, options) {
      const str = `${type}:${question || ''}:${JSON.stringify(options || [])}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return 'hash_' + hash;
    }

    /**
     * Sets task execution state with validation.
     */
    setState(newState) {
      if (this.state === newState) return;
      const oldState = this.state;
      this.state = newState;
      this._log('TASK_STATE_CHANGE', { from: oldState, to: newState });
      this.onStateChange(newState, oldState);
      this._persistState();
    }

    /**
     * Requests a user interaction, suspending agent execution until user responds.
     * @param {Object} params
     * @returns {Promise<Object>} The validated user response
     */
    async requestInteraction(params) {
      const type = params.type || 'confirm';
      const question = params.question || params.message || 'Harap konfirmasi tindakan:';
      const options = params.options || [];
      const description = params.description || null;
      const timeoutMs = params.timeoutMs || params.timeout_seconds ? params.timeout_seconds * 1000 : null;

      // Idempotency check: prevent duplicate pending widgets with identical payload
      const payloadHash = InteractionManager.hashPayload(type, question, options);
      if (this.activeInteraction && this.activeInteraction.status === InteractionStatus.PENDING) {
        if (this.activeInteraction.payloadHash === payloadHash) {
          this._log('INTERACTION_DUPLICATE', { interaction_id: this.activeInteraction.interaction_id, type });
          return this._waitForActiveInteraction();
        }
      }

      const interactionId = InteractionManager.generateId();
      const interaction = {
        interaction_id: interactionId,
        task_id: this.taskId,
        type,
        status: InteractionStatus.PENDING,
        question,
        description,
        options,
        action_name: params.action_name,
        parameters: params.parameters,
        required: params.required !== false,
        created_at: Date.now(),
        expires_at: timeoutMs ? Date.now() + timeoutMs : null,
        timeout_action: params.timeout_action || 'cancel',
        response: null,
        payloadHash,
      };

      this.activeInteraction = interaction;
      this._seenHashes.add(payloadHash);
      this.setState(TaskState.WAITING_FOR_USER);

      this._log('INTERACTION_CREATED', { interaction_id: interactionId, type, question });
      this._log('INTERACTION_SHOWN', { interaction_id: interactionId, type });
      this._log('INTERACTION_WAITING', { interaction_id: interactionId });

      this.onInteractionEvent({
        event: 'USER_INPUT_REQUIRED',
        interaction,
      });

      this._persistState();

      // Return promise that resolves strictly upon submitResponse()
      return new Promise((resolve, reject) => {
        let timer = null;
        if (timeoutMs) {
          timer = setTimeout(() => {
            if (this.activeInteraction && this.activeInteraction.interaction_id === interactionId && this.activeInteraction.status === InteractionStatus.PENDING) {
              this._handleTimeout(interactionId, interaction.timeout_action, resolve, reject);
            }
          }, timeoutMs);
        }

        this._pendingResolvers.set(interactionId, {
          resolve: (val) => {
            if (timer) clearTimeout(timer);
            resolve(val);
          },
          reject: (err) => {
            if (timer) clearTimeout(timer);
            reject(err);
          },
        });
      });
    }

    /**
     * Submits a user response with strict ATOMIC validation (Exactly-Once Resume).
     * @param {string} interactionId
     * @param {any} value
     * @param {Object} [meta]
     * @returns {boolean} True if response was accepted, False if already resolved/rejected
     */
    submitResponse(interactionId, value, meta = {}) {
      if (!this.activeInteraction || this.activeInteraction.interaction_id !== interactionId) {
        console.warn(`[InteractionManager] Interaction ${interactionId} not found or mismatch`);
        return false;
      }

      if (this.activeInteraction.status !== InteractionStatus.PENDING) {
        console.warn(`[InteractionManager] Interaction ${interactionId} already resolved: ${this.activeInteraction.status}`);
        return false;
      }

      this._log('INTERACTION_RESPONSE_RECEIVED', { interaction_id: interactionId, value });

      // Atomic transition: PENDING -> RESOLVED
      this.activeInteraction.status = InteractionStatus.RESOLVED;
      this.activeInteraction.response = {
        interaction_id: interactionId,
        value,
        submitted_at: Date.now(),
        source: 'user',
        feedback: meta.feedback || null,
        ...meta,
      };

      this._log('INTERACTION_VALIDATED', { interaction_id: interactionId });
      this._log('INTERACTION_RESOLVED', { interaction_id: interactionId, response: this.activeInteraction.response });

      const resolver = this._pendingResolvers.get(interactionId);
      if (resolver) {
        this._pendingResolvers.delete(interactionId);
        this.setState(TaskState.USER_RESPONDED);
        this._log('INTERACTION_RESUME', { interaction_id: interactionId });
        this.setState(TaskState.RUNNING);

        resolver.resolve(this.activeInteraction.response);
      }

      this._persistState();
      return true;
    }

    /**
     * Cancels the active interaction and pauses/aborts agent.
     */
    cancelInteraction(interactionId, reason = 'User cancelled interaction') {
      if (!this.activeInteraction || this.activeInteraction.interaction_id !== interactionId) {
        return false;
      }

      if (this.activeInteraction.status !== InteractionStatus.PENDING) {
        return false;
      }

      this.activeInteraction.status = InteractionStatus.CANCELLED;
      this._log('INTERACTION_CANCELLED', { interaction_id: interactionId, reason });

      const resolver = this._pendingResolvers.get(interactionId);
      if (resolver) {
        this._pendingResolvers.delete(interactionId);
        this.setState(TaskState.CANCELLED);
        resolver.reject(new Error(reason));
      }

      this._persistState();
      return true;
    }

    _handleTimeout(interactionId, timeoutAction, resolve, reject) {
      this.activeInteraction.status = InteractionStatus.EXPIRED;
      this._log('INTERACTION_EXPIRED', { interaction_id: interactionId, timeoutAction });
      this._pendingResolvers.delete(interactionId);

      if (timeoutAction === 'cancel') {
        this.setState(TaskState.CANCELLED);
        reject(new Error(`Interaction ${interactionId} expired.`));
      } else {
        this.setState(TaskState.RUNNING);
        resolve({ interaction_id: interactionId, expired: true, value: null });
      }

      this._persistState();
    }

    _waitForActiveInteraction() {
      const id = this.activeInteraction.interaction_id;
      return new Promise((resolve, reject) => {
        this._pendingResolvers.set(id, { resolve, reject });
      });
    }

    _log(type, payload) {
      console.log(`[InteractionManager:${type}]`, payload);
      this.onInteractionEvent({
        event: type,
        timestamp: Date.now(),
        taskId: this.taskId,
        ...payload,
      });
    }

    async _persistState() {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
      const data = {
        taskId: this.taskId,
        state: this.state,
        activeInteraction: this.activeInteraction,
        updatedAt: Date.now(),
      };
      chrome.storage.local.set({ [this.storageKey]: data });
    }

    async _initHydration() {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
      chrome.storage.local.get([this.storageKey], (result) => {
        const saved = result?.[this.storageKey];
        if (saved && saved.taskId === this.taskId) {
          if (saved.state === TaskState.WAITING_FOR_USER && saved.activeInteraction?.status === InteractionStatus.PENDING) {
            this.state = saved.state;
            this.activeInteraction = saved.activeInteraction;
            this.onInteractionEvent({
              event: 'USER_INPUT_REQUIRED',
              interaction: this.activeInteraction,
              hydrated: true,
            });
          }
        }
      });
    }
  }

  // Export to window/global
  global.TaskState = TaskState;
  global.InteractionStatus = InteractionStatus;
  global.InteractionManager = InteractionManager;

})(typeof window !== 'undefined' ? window : global);
