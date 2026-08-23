/**
 * Deep Browser Extension — Interactive Agent Widget System
 * =========================================================
 *
 * Structured AI-generated interactive widgets for human-in-the-loop:
 *   - confirm, choice, multi_choice, text_input, approval, progress, waiting
 */

(function(global) {
  'use strict';

  class WidgetManager {
    /**
     * @param {HTMLElement} mountContainer
     */
    constructor(mountContainer) {
      this.container = mountContainer;
      this.activeWidget = null;
    }

    /**
     * Clears any active widget from the UI.
     */
    clear() {
      if (this.container) {
        this.container.innerHTML = '';
        this.container.style.display = 'none';
      }
      this.activeWidget = null;
    }

    /**
     * Displays a structured Action Approval Proposal widget.
     * @param {Object} proposal - { action_name, parameters, reason }
     * @returns {Promise<{ approved: boolean, feedback?: string }>}
     */
    requestApproval(proposal) {
      return new Promise((resolve) => {
        if (!this.container) {
          return resolve({ approved: true });
        }

        this.container.style.display = 'block';
        this.container.innerHTML = `
          <div class="agent-widget-card approval">
            <div class="widget-header">
              <span class="widget-icon">🛡️</span>
              <span class="widget-title">Persetujuan Aksi Diperlukan</span>
            </div>
            <div class="widget-body">
              <div class="proposal-action">
                <span class="action-tag">${escapeHtml(proposal.action_name)}</span>
              </div>
              <pre class="proposal-params">${escapeHtml(JSON.stringify(proposal.parameters, null, 2))}</pre>
            </div>
            <div class="widget-feedback-wrap" style="display:none" id="widget-feedback-box">
              <input class="form-input" id="widget-reject-feedback" placeholder="Alasan penolakan / arahan baru..." />
            </div>
            <div class="widget-actions">
              <button class="btn-primary" id="btn-widget-approve">Setujui &amp; Jalankan</button>
              <button class="btn-ghost" id="btn-widget-reject" style="color:var(--destructive)">Tolak</button>
            </div>
          </div>
        `;

        const btnApprove = this.container.querySelector('#btn-widget-approve');
        const btnReject = this.container.querySelector('#btn-widget-reject');
        const feedbackBox = this.container.querySelector('#widget-feedback-box');
        const feedbackInput = this.container.querySelector('#widget-reject-feedback');

        btnApprove.addEventListener('click', () => {
          this.clear();
          resolve({ approved: true });
        });

        btnReject.addEventListener('click', () => {
          if (feedbackBox.style.display === 'none') {
            feedbackBox.style.display = 'block';
            feedbackInput.focus();
            btnReject.textContent = 'Kirim Penolakan';
          } else {
            const feedback = feedbackInput.value.trim() || 'Ditolak oleh pengguna';
            this.clear();
            resolve({ approved: false, feedback });
          }
        });
      });
    }

    /**
     * Displays a structured choice question widget.
     * @param {Object} data - { title, question, options: string[] }
     * @returns {Promise<string>} Selected option
     */
    requestChoice(data) {
      return new Promise((resolve) => {
        if (!this.container) return resolve(data.options?.[0] || '');

        this.container.style.display = 'block';
        const optionsHtml = (data.options || [])
          .map(
            (opt, i) =>
              `<button class="widget-choice-btn" data-index="${i}">${escapeHtml(opt)}</button>`
          )
          .join('');

        this.container.innerHTML = `
          <div class="agent-widget-card choice">
            <div class="widget-header">
              <span class="widget-icon">❓</span>
              <span class="widget-title">${escapeHtml(data.title || 'Pilih Opsi')}</span>
            </div>
            <div class="widget-body">
              <div class="widget-question">${escapeHtml(data.question || '')}</div>
              <div class="widget-options-list">${optionsHtml}</div>
            </div>
          </div>
        `;

        this.container.querySelectorAll('.widget-choice-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const chosen = data.options[idx];
            this.clear();
            resolve(chosen);
          });
        });
      });
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.WidgetManager = WidgetManager;
})(typeof window !== 'undefined' ? window : this);
