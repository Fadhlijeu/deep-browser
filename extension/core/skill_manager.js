/**
 * Deep Browser Extension — Local-First Skills & Macro Execution Engine
 * ===================================================================
 *
 * Implements 100% offline, local-first reusable browser skills and workflow macros:
 *   - Stored in chrome.storage.local (Zero cloud dependency)
 *   - Pre-installed curated built-in skills (PDDIKTI, GitHub, Article Scraper)
 *   - One-click "Save Run as Skill" generator from execution history
 *   - Autonomous skill execution via Tools ('execute_skill') & Slash Command (/skill)
 */

(function(global) {
  'use strict';

  const STORAGE_KEY = 'deep_browser_custom_skills';

  const BUILTIN_SKILLS = [
    {
      id: 'pddikti_search',
      title: 'Cari Data Mahasiswa PDDIKTI',
      description: 'Membuka portal resmi pddikti.kemdiktisaintek.go.id, mencari nama mahasiswa, dan mengekstrak tabel biodata lengkap.',
      category: 'Education & Verification',
      parameters: [
        { name: 'nama_mahasiswa', type: 'string', required: true, description: 'Nama lengkap mahasiswa yang dicari' },
        { name: 'kampus', type: 'string', required: false, description: 'Nama perguruan tinggi (opsional)' },
      ],
      preconditions: {
        url_pattern: '*pddikti*',
      },
      macroSteps: [
        { action: 'navigate', url: 'https://pddikti.kemdiktisaintek.go.id/' },
        { action: 'wait', seconds: 3, reason: 'Menunggu portal PDDIKTI dan indeks pencarian termuat' },
        { action: 'search_within', query: '{{nama_mahasiswa}}' },
      ],
    },
    {
      id: 'github_repo_lookup',
      title: 'Eksplorasi Repositori GitHub Organisasi/Pengguna',
      description: 'Membuka profil GitHub, beralih ke tab Repositories, dan menghitung/mendaftar seluruh repo secara tuntas.',
      category: 'Developer & Engineering',
      parameters: [
        { name: 'target_entity', type: 'string', required: true, description: 'Username atau organisasi GitHub (contoh: pallets, facebook)' },
      ],
      macroSteps: [
        { action: 'navigate', url: 'https://github.com/{{target_entity}}?tab=repositories' },
        { action: 'wait', seconds: 2, reason: 'Menunggu daftar repositori GitHub termuat' },
      ],
    },
    {
      id: 'article_substantive_highlighter',
      title: 'Sorot Substantif Definisi, Fungsi, dan Manfaat',
      description: 'Menganalisis artikel aktif dan menyorot paragraf substantif konsep utama menggunakan palet Color Theory.',
      category: 'Research & Study',
      parameters: [
        { name: 'topics', type: 'array', required: true, description: 'Daftar konsep yang ingin disorot (contoh: ["definisi", "fungsi", "manfaat"])' },
      ],
      macroSteps: [
        { action: 'highlight_sections', sections: '{{topics}}' },
      ],
    },
  ];

  class SkillManager {
    constructor() {
      this.cachedSkills = null;
    }

    /**
     * Lists all available skills (built-in + locally saved custom skills).
     * @returns {Promise<Array<Object>>}
     */
    static async listSkills() {
      let custom = [];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          const res = await chrome.storage.local.get(STORAGE_KEY);
          custom = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
        } catch (_) {}
      }
      return [...BUILTIN_SKILLS, ...custom];
    }

    /**
     * Gets a skill by its unique ID.
     * @param {string} skillId
     * @returns {Promise<Object|null>}
     */
    static async getSkill(skillId) {
      const skills = await SkillManager.listSkills();
      return skills.find(s => s.id === skillId) || null;
    }

    /**
     * Saves a new custom skill into local storage.
     * @param {Object} skill
     * @returns {Promise<boolean>}
     */
    static async saveSkill(skill) {
      if (!skill || !skill.id) throw new Error('Skill requires an "id" property.');
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;

      const res = await chrome.storage.local.get(STORAGE_KEY);
      const list = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
      const idx = list.findIndex(s => s.id === skill.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...skill, updated_at: Date.now() };
      } else {
        list.push({ ...skill, created_at: Date.now(), is_custom: true });
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: list });
      return true;
    }

    /**
     * Deletes a custom skill by ID.
     * @param {string} skillId
     * @returns {Promise<boolean>}
     */
    static async deleteSkill(skillId) {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
      const res = await chrome.storage.local.get(STORAGE_KEY);
      const list = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
      const updated = list.filter(s => s.id !== skillId);
      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      return true;
    }

    /**
     * Converts a successful agent execution history into a reusable skill definition.
     * @param {Object} params
     * @param {string} params.title
     * @param {string} params.description
     * @param {string} params.task
     * @param {Array<Object>} params.history
     * @returns {Promise<Object>}
     */
    static async recordRunToSkill({ title, description, task, history = [] }) {
      const skillId = 'skill_' + Date.now().toString(36);
      const macroSteps = [];

      for (const step of history) {
        if (step.actions && Array.isArray(step.actions)) {
          for (const act of step.actions) {
            if (act.action_name && act.action_name !== 'done') {
              macroSteps.push({
                action: act.action_name,
                params: act.parameters || {},
                step: step.step,
              });
            }
          }
        } else if (step.action && step.action.action_name && step.action.action_name !== 'done') {
          macroSteps.push({
            action: step.action.action_name,
            params: step.action.parameters || {},
            step: step.step,
          });
        }
      }

      const skill = {
        id: skillId,
        title: title || `Skill: ${task.slice(0, 30)}`,
        description: description || `Otomatisasi untuk: ${task}`,
        task_prompt_template: task,
        parameters: [],
        macroSteps,
        is_custom: true,
        created_at: Date.now(),
      };

      await SkillManager.saveSkill(skill);
      return skill;
    }

    /**
     * Executes a skill macro or subroutine.
     * @param {string} skillId
     * @param {Object} parameters
     * @param {BrowserSession} browserSession
     * @returns {Promise<Object>}
     */
    static async executeSkill(skillId, parameters = {}, browserSession) {
      const skill = await SkillManager.getSkill(skillId);
      if (!skill) {
        return { success: false, error: `Skill "${skillId}" tidak ditemukan.` };
      }

      if (!browserSession) {
        return { success: false, error: 'BrowserSession runtime tidak tersedia.' };
      }

      const executed = [];
      for (const step of (skill.macroSteps || [])) {
        const actName = step.action;
        let actParams = { ...(step.params || {}) };

        // Replace template parameters {{param}}
        for (const [key, val] of Object.entries(parameters || {})) {
          for (const [pKey, pVal] of Object.entries(actParams)) {
            if (typeof pVal === 'string' && pVal.includes(`{{${key}}}`)) {
              actParams[pKey] = pVal.replace(`{{${key}}}`, String(val));
            }
          }
        }

        try {
          if (actName === 'navigate' && actParams.url) {
            await browserSession.navigate(actParams.url);
          } else if (actName === 'wait') {
            await browserSession.wait(actParams.seconds || 2);
          } else if (actName === 'highlight_sections') {
            await browserSession.highlightSections(actParams.sections || []);
          }
          executed.push({ action: actName, params: actParams, success: true });
        } catch (e) {
          executed.push({ action: actName, params: actParams, success: false, error: e.message });
        }
      }

      return {
        success: true,
        skillId,
        skillTitle: skill.title,
        stepsExecuted: executed.length,
        executed,
      };
    }
  }

  global.SkillManager = SkillManager;
})(typeof window !== 'undefined' ? window : this);
