/**
 * Deep Browser Extension — Security & Action Policy Engine
 * =========================================================
 *
 * Enforces policy gates between proposed agent actions and execution:
 *   - SAFE: Immediate execution
 *   - REVIEW: Requires user approval in HITL mode or sensitive categories
 *   - BLOCKED: Prohibited actions
 */

(function(global) {
  'use strict';

  class SecurityPolicy {
    constructor() {
      this.policies = {
        // Safe read-only actions
        SAFE: ['navigate', 'scroll_page', 'scroll_to_text', 'hover', 'wait', 'extract', 'switch_tab'],
        // Sensitive actions requiring confirmation in review mode
        REVIEW: ['input_text', 'send_keys', 'close_tab', 'upload_file', 'download', 'select_dropdown_option'],
        // Dangerous blocked patterns
        BLOCKED: ['delete_account', 'transfer_money', 'execute_script'],
      };
    }

    /**
     * Checks if an action requires explicit human confirmation.
     * @param {string} actionName
     * @param {Object} params
     * @returns {boolean}
     */
    requiresReview(actionName, params = {}) {
      if (this.policies.BLOCKED.includes(actionName)) {
        return true;
      }

      // Check if action touches password / payment fields
      if (actionName === 'input_text') {
        const text = String(params.text || '').toLowerCase();
        if (text.includes('password') || text.includes('pin') || text.includes('credit')) {
          return true;
        }
      }

      return false;
    }

    /**
     * Checks if an action is strictly blocked.
     */
    isBlocked(actionName) {
      return this.policies.BLOCKED.includes(actionName);
    }
  }

  global.SecurityPolicy = SecurityPolicy;
})(typeof window !== 'undefined' ? window : this);
