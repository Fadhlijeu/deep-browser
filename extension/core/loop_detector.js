/**
 * Deep Browser Extension — Action Loop Detector & URL Shortener
 * ==============================================================
 *
 * Faithfully ported & adapted from upstream browser_use (legacy Python core):
 *   - PageFingerprint: Detects page stagnation across steps via state hashing
 *   - ActionLoopDetector: Rolling action hash window (size 20) with escalating nudges
 *   - UrlShortener: Truncates massive query/tracking parameters in prompts and recovers them upon action dispatch
 */

(function(global) {
  'use strict';

  // Fast, deterministic 53-bit string hash (cyrb53) returning a hex string
  function fastHash(str) {
    if (!str) return '00000000';
    let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const result = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    return result.padStart(12, '0').slice(0, 12);
  }

  // URL extraction pattern matching HTTP/HTTPS and WWW URLs
  const URL_REGEX = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

  /**
   * Lightweight fingerprint of the browser page state.
   */
  class PageFingerprint {
    constructor(url, elementCount, textHash) {
      this.url = String(url || '');
      this.elementCount = Number(elementCount || 0);
      this.textHash = String(textHash || '');
    }

    static fromBrowserState(url, domText, elementCount) {
      const sample = (domText || '').slice(0, 5000);
      const textHash = fastHash(sample);
      return new PageFingerprint(url, elementCount, textHash);
    }

    equals(other) {
      if (!other) return false;
      return (
        this.url === other.url &&
        this.elementCount === other.elementCount &&
        this.textHash === other.textHash
      );
    }
  }

  /**
   * Normalize action parameters for similarity hashing.
   * Matches upstream browser_use:
   * - search: lowercase, sort tokens, collapse whitespace
   * - click: element index identity
   * - input: index + trimmed lowercase text
   * - navigate: full URL
   * - scroll: direction + index
   * - highlight: sorted topic list
   */
  function normalizeActionForHash(actionName, params = {}) {
    const name = String(actionName || '').toLowerCase().trim();
    const p = params || {};

    if (name === 'search' || name === 'search_page') {
      const query = String(p.query || p.text || '').toLowerCase();
      const tokens = query.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join('_');
      return `search|${tokens}`;
    }

    if (['click_element', 'click'].includes(name)) {
      return `click|${p.index ?? ''}`;
    }

    if (['input_text', 'input'].includes(name)) {
      const text = String(p.text || '').trim().toLowerCase();
      return `input|${p.index ?? ''}|${text}`;
    }

    if (['navigate', 'go_to_url'].includes(name)) {
      const url = String(p.url || p.target || '').trim();
      return `navigate|${url}`;
    }

    if (['scroll_page', 'scroll'].includes(name)) {
      const dir = p.down !== false ? 'down' : 'up';
      return `scroll|${dir}|${p.index ?? ''}`;
    }

    if (name === 'highlight_sections') {
      const sections = Array.isArray(p.sections)
        ? p.sections.map(s => typeof s === 'string' ? s : (s.topic || s.name || '')).sort().join(',')
        : '';
      return `highlight_sections|${sections}`;
    }

    // Default: action name + sorted parameters
    const sortedKeys = Object.keys(p).sort();
    const filtered = {};
    for (const k of sortedKeys) {
      if (p[k] !== undefined && p[k] !== null) {
        filtered[k] = p[k];
      }
    }
    return `${name}|${JSON.stringify(filtered)}`;
  }

  function computeActionHash(actionName, params = {}) {
    const normalized = normalizeActionForHash(actionName, params);
    return fastHash(normalized);
  }

  /**
   * Tracks action repetition and page stagnation to detect behavioral loops.
   * Generates escalating context nudges for the LLM without hard-blocking.
   */
  class ActionLoopDetector {
    constructor(options = {}) {
      this.windowSize = options.windowSize || 20;
      this.recentActionHashes = [];
      this.actionSignatures = new Map(); // hash -> normalized string
      this.recentPageFingerprints = [];
      this.maxRepetitionCount = 0;
      this.mostRepeatedHash = null;
      this.consecutiveStagnantPages = 0;

      // Actions that are legitimate during waiting or recovery and should not count as toxic loops
      this.exemptActions = new Set(['wait', 'done', 'go_back', 'ask_user', 'take_screenshot', 'screenshot']);
    }

    recordAction(actionName, params = {}) {
      const name = String(actionName || '').toLowerCase().trim();
      if (this.exemptActions.has(name)) return;

      const norm = normalizeActionForHash(name, params);
      const h = fastHash(norm);

      this.actionSignatures.set(h, norm);
      this.recentActionHashes.push(h);

      if (this.recentActionHashes.length > this.windowSize) {
        this.recentActionHashes.shift();
      }

      this._updateRepetitionStats();
    }

    recordPageState(url, domText, elementCount) {
      const fp = PageFingerprint.fromBrowserState(url, domText, elementCount);
      if (this.recentPageFingerprints.length > 0) {
        const last = this.recentPageFingerprints[this.recentPageFingerprints.length - 1];
        if (last.equals(fp)) {
          this.consecutiveStagnantPages++;
        } else {
          this.consecutiveStagnantPages = 0;
        }
      }

      this.recentPageFingerprints.push(fp);
      if (this.recentPageFingerprints.length > 6) {
        this.recentPageFingerprints.shift();
      }
    }

    _updateRepetitionStats() {
      if (this.recentActionHashes.length === 0) {
        this.maxRepetitionCount = 0;
        this.mostRepeatedHash = null;
        return;
      }

      const counts = {};
      for (const h of this.recentActionHashes) {
        counts[h] = (counts[h] || 0) + 1;
      }

      let maxCount = 0;
      let topHash = null;
      for (const [h, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          topHash = h;
        }
      }

      this.maxRepetitionCount = maxCount;
      this.mostRepeatedHash = topHash;
    }

    getMostRepeatedSignature() {
      if (!this.mostRepeatedHash) return '';
      return this.actionSignatures.get(this.mostRepeatedHash) || 'repetitive action';
    }

    /**
     * Returns an escalating awareness nudge based on repetition and stagnation severity.
     */
    getNudgeMessage() {
      const messages = [];
      const sig = this.getMostRepeatedSignature();

      // Escalating repetition levels: 4, 7, 10
      if (this.maxRepetitionCount >= 10) {
        messages.push(
          `🛑 CRITICAL REPETITION LOOP DETECTED: You have executed a similar action (\`${sig}\`) ${this.maxRepetitionCount} times in the last ${this.recentActionHashes.length} steps without achieving the objective. ` +
          `STOP repeating this action immediately. You MUST pivot to an entirely different strategy, choose an alternative element, scroll, or conclude.`
        );
      } else if (this.maxRepetitionCount >= 7) {
        messages.push(
          `⚠️ HIGH ACTION REPETITION: You have repeated a similar action (\`${sig}\`) ${this.maxRepetitionCount} times in the last ${this.recentActionHashes.length} steps. ` +
          `If this loop is intentional (e.g. paginating through a catalog), continue carefully. Otherwise, please reconsider your approach and try a different method.`
        );
      } else if (this.maxRepetitionCount >= 4) {
        messages.push(
          `ℹ️ ACTION REPETITION NOTICE: A similar action (\`${sig}\`) has been performed ${this.maxRepetitionCount} times recently. Ensure each step produces new information.`
        );
      }

      // Page stagnation nudges
      if (this.consecutiveStagnantPages >= 4) {
        messages.push(
          `⚠️ PAGE STAGNATION DETECTED: The webpage content and interactive elements have remained unchanged across ${this.consecutiveStagnantPages} consecutive actions. ` +
          `Your recent actions may have had no effect. Try interacting with a different element, scrolling, or checking for error messages/dialogs.`
        );
      }

      return messages.length > 0 ? messages.join('\n\n') : null;
    }

    reset() {
      this.recentActionHashes = [];
      this.actionSignatures.clear();
      this.recentPageFingerprints = [];
      this.maxRepetitionCount = 0;
      this.mostRepeatedHash = null;
      this.consecutiveStagnantPages = 0;
    }
  }

  /**
   * URL Shortener: Truncates bloated tracking parameters and restores them on action dispatch.
   * Based on browser_use legacy URL replacement algorithm.
   */
  class UrlShortener {
    constructor(options = {}) {
      this.urlLimit = options.urlLimit || 45; // Max length of query string before truncation
      this.urlMap = new Map(); // shortenedUrl -> originalUrl
      this.reverseMap = new Map(); // originalUrl -> shortenedUrl
    }

    /**
     * Shortens a single URL if its query string or fragment is excessively long.
     */
    shortenUrl(originalUrl) {
      if (!originalUrl || typeof originalUrl !== 'string') return originalUrl;

      if (this.reverseMap.has(originalUrl)) {
        return this.reverseMap.get(originalUrl);
      }

      const queryStart = originalUrl.indexOf('?');
      const fragStart = originalUrl.indexOf('#');

      let afterPathStart = originalUrl.length;
      if (queryStart !== -1) afterPathStart = Math.min(afterPathStart, queryStart);
      if (fragStart !== -1) afterPathStart = Math.min(afterPathStart, fragStart);

      const baseUrl = originalUrl.slice(0, afterPathStart);
      const afterPath = originalUrl.slice(afterPathStart);

      if (afterPath.length <= this.urlLimit) {
        return originalUrl;
      }

      // Truncate and append short hash
      const truncatedPath = afterPath.slice(0, 20);
      const hashPart = fastHash(afterPath).slice(0, 7);
      const shortened = `${baseUrl}${truncatedPath}...${hashPart}`;

      if (shortened.length < originalUrl.length) {
        this.urlMap.set(shortened, originalUrl);
        this.reverseMap.set(originalUrl, shortened);
        return shortened;
      }

      return originalUrl;
    }

    /**
     * Replaces long URLs in a block of text (e.g. Simplified DOM Tree or Prompt).
     */
    shortenText(text) {
      if (!text || typeof text !== 'string') return text;
      let count = 0;

      const shortenedText = text.replace(URL_REGEX, (match) => {
        const res = this.shortenUrl(match);
        if (res !== match) count++;
        return res;
      });

      return { shortenedText, count };
    }

    /**
     * Restores original URL from a string that may be or contain a shortened URL.
     */
    restoreUrl(text) {
      if (!text || typeof text !== 'string') return text;

      // Direct exact match
      if (this.urlMap.has(text)) {
        return this.urlMap.get(text);
      }

      // Substring match
      let restored = text;
      for (const [shortUrl, originalUrl] of this.urlMap.entries()) {
        if (restored.includes(shortUrl)) {
          restored = restored.split(shortUrl).join(originalUrl);
        }
      }
      return restored;
    }

    /**
     * Recursively inspects parameter objects/arrays and restores any shortened URLs.
     */
    restoreParams(params) {
      if (!params || typeof params !== 'object') {
        if (typeof params === 'string') return this.restoreUrl(params);
        return params;
      }

      if (Array.isArray(params)) {
        return params.map(item => this.restoreParams(item));
      }

      const restoredObj = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
          restoredObj[key] = this.restoreUrl(value);
        } else if (value && typeof value === 'object') {
          restoredObj[key] = this.restoreParams(value);
        } else {
          restoredObj[key] = value;
        }
      }
      return restoredObj;
    }

    clear() {
      this.urlMap.clear();
      this.reverseMap.clear();
    }
  }

  // Export to global scope
  global.PageFingerprint = PageFingerprint;
  global.ActionLoopDetector = ActionLoopDetector;
  global.UrlShortener = UrlShortener;
  global.computeActionHash = computeActionHash;
  global.normalizeActionForHash = normalizeActionForHash;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
