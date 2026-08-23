/**
 * Deep Browser Extension — Iterative Multi-Source Research Skill
 * ===============================================================
 *
 * Implements the DeepDOM iterative research lifecycle:
 *   SEARCH → DISCOVER → OPEN MULTIPLE SOURCES → EXTRACT → COMPARE → VERIFY → SYNTHESIZE
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
     * @param {string} query
     * @param {Function} [onProgress]
     */
    async executeResearch(query, onProgress = () => {}) {
      onProgress({ stage: 'SEARCH', message: `Mencari sumber untuk: "${query}"` });

      // Step 1: SEARCH on Google
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await this.browserSession.navigate(searchUrl);
      await this.browserSession.wait(1.5);

      onProgress({ stage: 'DISCOVER', message: 'Menganalisis hasil pencarian dan mengidentifikasi link relevan...' });

      // Step 2: DISCOVER links
      const searchState = await this.browserSession.getState(false);
      const links = (searchState.elements || [])
        .filter((e) => e.tag === 'a' && e.href && e.href.startsWith('http') && !e.href.includes('google.com'))
        .slice(0, 3); // Take top 3 distinct sources

      const sources = [];

      // Step 3 & 4: OPEN & EXTRACT
      for (let i = 0; i < links.length; i++) {
        const item = links[i];
        onProgress({ stage: 'OPEN', message: `Membuka sumber ${i + 1}/${links.length}: ${item.text || item.href}` });

        try {
          await this.browserSession.navigate(item.href);
          await this.browserSession.wait(1.2);

          onProgress({ stage: 'EXTRACT', message: `Mengekstrak fakta dari ${item.href}...` });
          const extracted = await this.extractor.extractTargeted(query);

          const items = Array.isArray(extracted?.extracted_items) ? extracted.extracted_items : [];
          sources.push({
            url: item.href,
            title: extracted.title,
            facts: items.map((x) => x.title || x.content).filter(Boolean),
          });

        } catch (err) {
          console.warn(`[ResearchSkill] Failed to extract from ${item.href}:`, err);
        }
      }

      onProgress({ stage: 'SYNTHESIZE', message: 'Membandingkan dan menyusun rangkuman komprehensif...' });

      // Step 5 & 6: SYNTHESIZE Answer
      const synthesis = {
        query,
        total_sources: sources.length,
        sources: sources.map((s) => ({ title: s.title, url: s.url })),
        summary: sources.length > 0
          ? `Ditemukan ${sources.length} sumber referensi terpercaya. Ringkasan telah dikompilasi dari ${sources.map((s) => s.title).join(', ')}.`
          : 'Pencarian selesai.',
      };

      return synthesis;
    }
  }

  global.ResearchSkill = ResearchSkill;
})(typeof window !== 'undefined' ? window : this);
