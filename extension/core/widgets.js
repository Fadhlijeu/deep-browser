/**
 * Deep Browser Extension — Interactive Widget Renderer & Controller
 * =================================================================
 *
 * Renders structured Human-in-the-Loop widget cards:
 *   1. choice (Single select with Arrow keys + Enter)
 *   2. multi_choice (Multiple checkboxes + Enter)
 *   3. confirm (Yes / No with Enter / Escape)
 *   4. text_input (Text input with Enter)
 *   5. number_input (Counter [- N +])
 *   6. file_picker (File selector)
 *   7. approval (Action review: [A]pprove / [R]eject / [E]dit)
 *   8. waiting (Manual CAPTCHA / User confirmation with [Done] / [Cancel])
 */

(function(global) {
  'use strict';

  class WidgetManager {
    constructor(containerElement, interactionManager = null) {
      this.container = containerElement;
      this.interactionManager = interactionManager;
      this.currentCard = null;
      this.activeResolver = null;
    }

    setInteractionManager(im) {
      this.interactionManager = im;
    }

    /**
     * Renders an interaction directly from an Interaction object.
     * @param {Object} interaction
     * @returns {Promise<Object>}
     */
    renderInteraction(interaction) {
      this.clear();
      if (!this.container) return Promise.resolve({ approved: true });

      const type = interaction.type || 'confirm';
      const ixId = interaction.interaction_id;

      return new Promise((resolve) => {
        this.activeResolver = resolve;

        const card = document.createElement('div');
        card.className = 'agent-widget-card';
        card.id = `widget_${ixId}`;
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('tabindex', '-1');

        let innerContent = '';

        switch (type) {
          case 'choice':
            innerContent = this._renderChoiceHtml(interaction);
            break;
          case 'multi_choice':
            innerContent = this._renderMultiChoiceHtml(interaction);
            break;
          case 'confirm':
            innerContent = this._renderConfirmHtml(interaction);
            break;
          case 'text_input':
            innerContent = this._renderTextInputHtml(interaction);
            break;
          case 'number_input':
            innerContent = this._renderNumberInputHtml(interaction);
            break;
          case 'file_picker':
            innerContent = this._renderFilePickerHtml(interaction);
            break;
          case 'approval':
            innerContent = this._renderApprovalHtml(interaction);
            break;
          case 'waiting':
            innerContent = this._renderWaitingHtml(interaction);
            break;
          default:
            innerContent = this._renderConfirmHtml(interaction);
        }

        card.innerHTML = innerContent;
        this.container.appendChild(card);
        this.currentCard = card;

        // Bind interactive events & keyboard shortcuts
        this._bindCardEvents(card, interaction, resolve);

        // Auto-focus first interactive element
        setTimeout(() => {
          const firstFocusable = card.querySelector('button, input, select, textarea');
          if (firstFocusable) firstFocusable.focus();
        }, 50);
      });
    }

    _renderChoiceHtml(ix) {
      const options = ix.options || [];
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">help_outline</span>
          <span class="widget-title">${this._esc(ix.question || 'Pilih salah satu opsi:')}</span>
        </div>
        ${ix.description ? `<div class="widget-desc">${this._esc(ix.description)}</div>` : ''}
        <div class="widget-options-list" role="radiogroup">
          ${options.map((opt, idx) => `
            <button class="widget-choice-btn" data-id="${this._esc(opt.id || opt.value || opt)}" data-index="${idx}">
              <span class="choice-key">${idx + 1}</span>
              <div style="flex:1;text-align:left">
                <div style="font-weight:500">${this._esc(opt.label || opt.name || opt)}</div>
                ${opt.description ? `<div style="font-size:10px;color:var(--muted-foreground)">${this._esc(opt.description)}</div>` : ''}
              </div>
            </button>
          `).join('')}
        </div>
      `;
    }

    _renderMultiChoiceHtml(ix) {
      const options = ix.options || [];
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">checklist</span>
          <span class="widget-title">${this._esc(ix.question || 'Pilih beberapa opsi:')}</span>
        </div>
        <div class="widget-options-list">
          ${options.map((opt) => `
            <label class="widget-checkbox-label">
              <input type="checkbox" class="widget-chk" value="${this._esc(opt.id || opt.value || opt)}" />
              <span>${this._esc(opt.label || opt.name || opt)}</span>
            </label>
          `).join('')}
        </div>
        <div class="widget-actions" style="margin-top:8px">
          <button class="btn-primary btn-submit-multichoice" style="width:100%">Lanjutkan (Enter)</button>
        </div>
      `;
    }

    _renderConfirmHtml(ix) {
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b">info</span>
          <span class="widget-title">${this._esc(ix.question || 'Konfirmasi Tindakan')}</span>
        </div>
        ${ix.description ? `<div class="widget-desc">${this._esc(ix.description)}</div>` : ''}
        <div class="widget-actions">
          <button class="btn-primary btn-confirm-yes">Ya, Lanjutkan (Enter)</button>
          <button class="btn-ghost btn-confirm-no">Batal (Esc)</button>
        </div>
      `;
    }

    _renderTextInputHtml(ix) {
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">edit</span>
          <span class="widget-title">${this._esc(ix.question || 'Masukkan Data')}</span>
        </div>
        <div style="margin:6px 0">
          <input type="text" class="form-input widget-text-val" placeholder="${this._esc(ix.description || 'Ketik di sini...')}" />
        </div>
        <div class="widget-actions">
          <button class="btn-primary btn-submit-text">Kirim (Enter)</button>
          <button class="btn-ghost btn-cancel-text">Batal (Esc)</button>
        </div>
      `;
    }

    _renderNumberInputHtml(ix) {
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">pin</span>
          <span class="widget-title">${this._esc(ix.question || 'Jumlah')}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0">
          <button class="btn-secondary btn-num-dec" style="width:32px;height:32px;font-size:16px">-</button>
          <span class="widget-num-val" style="font-size:16px;font-weight:600;min-width:30px;text-align:center">1</span>
          <button class="btn-secondary btn-num-inc" style="width:32px;height:32px;font-size:16px">+</button>
        </div>
        <div class="widget-actions">
          <button class="btn-primary btn-submit-number">Lanjutkan (Enter)</button>
        </div>
      `;
    }

    _renderFilePickerHtml(ix) {
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">upload_file</span>
          <span class="widget-title">${this._esc(ix.question || 'Pilih File')}</span>
        </div>
        <div style="margin:8px 0">
          <input type="file" class="widget-file-input" style="font-size:11px" />
        </div>
        <div class="widget-actions">
          <button class="btn-primary btn-submit-file">Upload &amp; Lanjut</button>
        </div>
      `;
    }

    _renderApprovalHtml(ix) {
      const actionName = ix.action_name || 'Tindakan Sensitif';
      const paramsStr = JSON.stringify(ix.parameters || {}, null, 2);
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b">shield</span>
          <span class="widget-title">Review Diperlukan</span>
        </div>
        <div class="widget-desc">Agent mengusulkan tindakan: <strong style="color:var(--foreground)">${this._esc(actionName)}</strong></div>
        <pre class="widget-code-preview">${this._esc(paramsStr)}</pre>
        <div class="widget-actions">
          <button class="btn-primary btn-approve" title="Shortkey: A">Setujui (A)</button>
          <button class="btn-ghost btn-reject" style="color:var(--destructive)" title="Shortkey: R">Tolak (R)</button>
          <button class="btn-ghost btn-edit" title="Shortkey: E">Ubah (E)</button>
        </div>
      `;
    }

    _renderWaitingHtml(ix) {
      return `
        <div class="widget-header">
          <span class="material-symbols-outlined" style="font-size:16px;color:#38bdf8">hourglass_top</span>
          <span class="widget-title">Menunggu Tindakan Manual</span>
        </div>
        <div class="widget-desc">${this._esc(ix.question || 'Silakan selesaikan aksi / CAPTCHA di browser Edge.')}</div>
        <div class="widget-actions" style="margin-top:8px">
          <button class="btn-primary btn-waiting-done">Selesai, Lanjutkan (Enter)</button>
          <button class="btn-ghost btn-waiting-cancel">Batalkan</button>
        </div>
      `;
    }

    _bindCardEvents(card, ix, resolve) {
      const resolveAndSubmit = (val, meta = {}) => {
        if (this.interactionManager) {
          this.interactionManager.submitResponse(ix.interaction_id, val, meta);
        }
        this.clear();
        resolve({ approved: val !== false && val !== 'reject', value: val, ...meta });
      };

      const rejectAndSubmit = (reason = 'User rejected') => {
        if (this.interactionManager) {
          this.interactionManager.cancelInteraction(ix.interaction_id, reason);
        }
        this.clear();
        resolve({ approved: false, value: 'reject', feedback: reason });
      };

      // Choice buttons
      card.querySelectorAll('.widget-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          resolveAndSubmit(btn.dataset.id);
        });
      });

      // Multi choice
      const btnMulti = card.querySelector('.btn-submit-multichoice');
      if (btnMulti) {
        btnMulti.addEventListener('click', () => {
          const selected = Array.from(card.querySelectorAll('.widget-chk:checked')).map((c) => c.value);
          resolveAndSubmit(selected);
        });
      }

      // Confirm Yes/No
      const btnYes = card.querySelector('.btn-confirm-yes');
      const btnNo = card.querySelector('.btn-confirm-no');
      if (btnYes) btnYes.addEventListener('click', () => resolveAndSubmit(true));
      if (btnNo) btnNo.addEventListener('click', () => resolveAndSubmit(false));

      // Text input
      const btnText = card.querySelector('.btn-submit-text');
      const inpText = card.querySelector('.widget-text-val');
      if (btnText && inpText) {
        btnText.addEventListener('click', () => resolveAndSubmit(inpText.value.trim()));
        inpText.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') resolveAndSubmit(inpText.value.trim());
          if (e.key === 'Escape') rejectAndSubmit('Cancelled by user');
        });
      }

      // Number input
      const btnInc = card.querySelector('.btn-num-inc');
      const btnDec = card.querySelector('.btn-num-dec');
      const numDisplay = card.querySelector('.widget-num-val');
      const btnNumSubmit = card.querySelector('.btn-submit-number');
      let currentNum = 1;
      if (btnInc && btnDec && numDisplay && btnNumSubmit) {
        btnInc.addEventListener('click', () => {
          currentNum++;
          numDisplay.textContent = currentNum;
        });
        btnDec.addEventListener('click', () => {
          if (currentNum > 1) currentNum--;
          numDisplay.textContent = currentNum;
        });
        btnNumSubmit.addEventListener('click', () => resolveAndSubmit(currentNum));
      }

      // Approval (A / R / E)
      const btnApprove = card.querySelector('.btn-approve');
      const btnReject = card.querySelector('.btn-reject');
      const btnEdit = card.querySelector('.btn-edit');
      if (btnApprove) btnApprove.addEventListener('click', () => resolveAndSubmit('approve', { approved: true }));
      if (btnReject) {
        btnReject.addEventListener('click', () => {
          const fb = prompt('Alasan penolakan / instruksi alternatif:', 'Tindakan dibatalkan oleh pengguna.');
          resolveAndSubmit('reject', { approved: false, feedback: fb || 'Rejected' });
        });
      }
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          const newInstr = prompt('Edit instruksi:', ix.question || '');
          resolveAndSubmit('edit', { approved: false, feedback: newInstr || 'Edit requested' });
        });
      }

      // Waiting (Done / Cancel)
      const btnDone = card.querySelector('.btn-waiting-done');
      const btnWaitCancel = card.querySelector('.btn-waiting-cancel');
      if (btnDone) btnDone.addEventListener('click', () => resolveAndSubmit('done'));
      if (btnWaitCancel) btnWaitCancel.addEventListener('click', () => rejectAndSubmit('Waiting cancelled'));

      // Global Keyboard Shortcuts on Card
      card.addEventListener('keydown', (e) => {
        if (e.key === 'a' || e.key === 'A') {
          if (btnApprove) { e.preventDefault(); btnApprove.click(); }
        } else if (e.key === 'r' || e.key === 'R') {
          if (btnReject) { e.preventDefault(); btnReject.click(); }
        } else if (e.key === 'e' || e.key === 'E') {
          if (btnEdit) { e.preventDefault(); btnEdit.click(); }
        } else if (e.key === 'Escape') {
          if (btnNo) btnNo.click();
        }
      });
    }

    clear() {
      if (this.container) {
        this.container.innerHTML = '';
      }
      this.currentCard = null;
      this.activeResolver = null;
    }

    _esc(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  global.WidgetManager = WidgetManager;

})(typeof window !== 'undefined' ? window : global);
