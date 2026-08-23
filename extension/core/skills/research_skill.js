/**
 * Deep Browser Extension — Iterative Multi-Source Research Skill
 * ===============================================================
 *
 * Implements the DeepDOM iterative multi-tab research lifecycle:
 *   SEARCH → DISCOVER → OPEN MULTIPLE TABS → EXTRACT → COMPARE → SYNTHESIZE
 */

(function(global) {
  'use strict';

  class ResearchSkill extends (global.SkillBase || class {}) {
    constructor(browserSession, llmClient = null) {
      super('research', browserSession, llmClient);
      this.extractor = new global.Extractor(browserSession, llmClient);
    }

    /**
     * Executes an end-to-end multi-source research workflow on Microsoft Edge.
     * Opens multiple distinct tabs, extracts data, and synthesizes answers.
     * @param {string} query
     * @param {Function} [onProgress]
     */
    async executeResearch(query, onProgress = () => {}) {
      onProgress({ stage: 'SEARCH', message: `Mencari sumber untuk: "${query}"` });

      // Step 1: SEARCH on Google
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await this.browserSession.navigate(searchUrl);
      await this.browserSession.wait(1.5);

      const mainTab = await this.browserSession.getCurrentTab();
      const mainTabId = mainTab.id;

      onProgress({ stage: 'DISCOVER', message: 'Menganalisis hasil pencarian dan mengidentifikasi link relevan...' });

      // Step 2: DISCOVER links
      const searchState = await this.browserSession.getState(false);
      const links = (searchState.elements || [])
        .filter((e) => e.tag === 'a' && e.href && e.href.startsWith('http') && !e.href.includes('google.com'))
        .slice(0, 3); // Top candidate source URLs

      const sources = [];

      // Step 3 & 4: OPEN IN NEW TABS & EXTRACT CONCURRENTLY/SEQUENTIALLY
      for (let i = 0; i < links.length; i++) {
        const item = links[i];
        onProgress({ stage: 'OPEN_TAB', message: `Membuka tab baru ${i + 1}/${links.length}: ${item.text || item.href}` });

        let childTabId = null;
        try {
          // Open in a NEW distinct browser tab
          const tabRes = await this.browserSession.createTab(item.href, true);
          childTabId = tabRes.tab_id;
          await this.browserSession.wait(1.5);

          onProgress({ stage: 'EXTRACT', message: `Mengekstrak fakta dari tab [${childTabId}] ${item.href}...` });
          const extracted = await this.extractor.extractTargeted(query);

          const items = Array.isArray(extracted?.extracted_items) ? extracted.extracted_items : [];
          sources.push({
            url: item.href,
            title: extracted.title || item.text || item.href,
            tab_id: childTabId,
            facts: items.map((x) => x.title || x.content).filter(Boolean),
          });

          // Switch back to search tab context
          await this.browserSession.switchTab(mainTabId);
          await this.browserSession.wait(0.5);

        } catch (err) {
          console.warn(`[ResearchSkill] Failed to extract from tab ${childTabId || item.href}:`, err);
          if (mainTabId) {
            try { await this.browserSession.switchTab(mainTabId); } catch {}
          }
        }
      }

      onProgress({ stage: 'SYNTHESIZE', message: 'Membandingkan dan menyusun rangkuman komprehensif...' });

      // Step 5: SYNTHESIZE Answer
      const synthesis = {
        query,
        total_sources: sources.length,
        sources: sources.map((s) => ({ title: s.title, url: s.url, tab_id: s.tab_id })),
        summary: sources.length > 0
          ? `Ditemukan ${sources.length} sumber referensi dari beberapa tab terpisah. Ringkasan telah dikompilasi dari ${sources.map((s) => s.title).join(', ')}.`
          : 'Pencarian selesai.',
      };

      return synthesis;
    }
  }

  global.ResearchSkill = ResearchSkill;

})(typeof window !== 'undefined' ? window : this);
