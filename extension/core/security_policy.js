/**
 * Deep Browser Extension — Security & Action Policy Engine
 * =========================================================
 *
 * Enforces policy gates between proposed agent actions and execution:
 *   - SAFE: Immediate execution
 *   - REVIEW: Requires user approval in HITL mode or sensitive categories
 *   - BLOCKED: Prohibited actions
 *   - PRESET POLICIES: Research, Data Extraction, Form Filling, Read-only Mode
 */

(function(global) {
  'use strict';

  class SecurityPolicy {
    /**
     * @param {Object} [options]
     * @param {string} [options.preset='default'] - 'default' | 'research' | 'data_extraction' | 'form_filling' | 'read_only'
     */
    constructor(options = {}) {
      this.preset = options.preset || 'default';
      this.policies = {
        // Safe read-only actions
        SAFE: ['navigate', 'scroll_page', 'scroll_to_text', 'hover', 'wait', 'extract', 'switch_tab', 'take_screenshot', 'save_as_pdf', 'get_state', 'done'],
        // Sensitive actions requiring confirmation in review mode
        REVIEW: ['input_text', 'send_keys', 'close_tab', 'upload_file', 'download', 'select_dropdown_option'],
        // Dangerous blocked patterns
        BLOCKED: ['delete_account', 'transfer_money', 'execute_script'],
      };
    }

    setPreset(preset) {
      if (preset) this.preset = preset;
    }

    /**
     * Checks if an action is permitted by the active preset.
     * @param {string} actionName
     * @param {Object} [params]
     * @returns {boolean}
     */
    isActionAllowed(actionName, params = {}) {
      if (this.isBlocked(actionName)) return false;

      if (this.preset === 'read_only') {
        const allowedInReadOnly = new Set([
          'navigate', 'scroll_page', 'scroll_to_text', 'hover', 'wait', 'extract',
          'switch_tab', 'take_screenshot', 'save_as_pdf', 'get_state', 'get_page_html', 'done'
        ]);
        return allowedInReadOnly.has(actionName);
      }

      if (this.preset === 'data_extraction') {
        const allowedInExtraction = new Set([
          'navigate', 'scroll_page', 'scroll_to_text', 'hover', 'wait', 'extract',
          'switch_tab', 'take_screenshot', 'save_as_pdf', 'get_state', 'get_page_html', 'click_element', 'done'
        ]);
        return allowedInExtraction.has(actionName);
      }

      return true;
    }

    /**
     * Checks if an action is high-risk (financial transactions, account deletion, sensitive credentials),
     * which MUST always require human confirmation even in 'Always Proceed' (auto) mode.
     */
    isHighRisk(actionName, params = {}) {
      if (this.isBlocked(actionName)) return true;

      const actLower = String(actionName || '').toLowerCase();
      if (actLower.includes('delete') || actLower.includes('transfer') || actLower.includes('pay') || actLower.includes('purchase')) {
        return true;
      }

      if (actionName === 'input_text') {
        const text = String(params.text || '').toLowerCase();
        if (text.includes('password') || text.includes('pin') || text.includes('credit') || text.includes('cvv') || text.includes('token') || text.includes('secret') || text.includes('private_key') || text.includes('seed')) {
          return true;
        }
      }

      if (actionName === 'click_element') {
        const target = String(params.target || params.text || '').toLowerCase();
        if (target.includes('bayar') || target.includes('pay') || target.includes('transfer') || target.includes('checkout') || target.includes('delete account') || target.includes('hapus akun')) {
          return true;
        }
      }

      return false;
    }

    /**
     * Checks if an action requires explicit human confirmation.
     * @param {string} actionName
     * @param {Object} params
     * @returns {boolean}
     */
    requiresReview(actionName, params = {}) {
      if (this.isHighRisk(actionName, params)) {
        return true;
      }

      if (this.policies.BLOCKED.includes(actionName)) {
        return true;
      }

      // Read-only preset blocks mutations or forces approval if invoked
      if (this.preset === 'read_only' && !this.policies.SAFE.includes(actionName)) {
        return true;
      }

      if (actionName === 'download') {
        return true;
      }

      // Form filling preset gates final submit clicks
      if (this.preset === 'form_filling' && actionName === 'click_element') {
        const targetText = String(params.target || '').toLowerCase();
        if (targetText.includes('submit') || targetText.includes('kirim') || targetText.includes('confirm')) {
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
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityPolicy;
  }
})(typeof window !== 'undefined' ? window : global);
