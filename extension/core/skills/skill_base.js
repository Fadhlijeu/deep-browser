/**
 * Deep Browser Extension — Skill Base Architecture
 * =================================================
 *
 * Modular skill foundation extending Browser Use capabilities
 * without creating duplicate agent loops.
 */

(function(global) {
  'use strict';

  class SkillBase {
    /**
     * @param {string} name
     * @param {BrowserSession} browserSession
     * @param {LLMClient} [llmClient]
     */
    constructor(name, browserSession, llmClient = null) {
      this.name = name;
      this.browserSession = browserSession;
      this.llmClient = llmClient;
    }

    /**
     * Returns additional tool action schemas provided by this skill.
     */
    getTools() {
      return [];
    }

    /**
     * Pre-action hook for policy or parameter transformation.
     */
    async beforeAction(actionName, params) {
      return params;
    }

    /**
     * Post-action hook for verification or specialized extraction.
     */
    async afterAction(actionName, params, result) {
      return result;
    }
  }

  global.SkillBase = SkillBase;
})(typeof window !== 'undefined' ? window : this);
