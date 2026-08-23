/**
 * Deep Browser Extension — Interactive Widget Renderer & Controller
 * =================================================================
 *
 * Anti-AI-Slop, High-Performance Human-in-the-Loop Widget System:
 *   1. choice (Single select with 1..9 keys / click)
 *   2. multi_choice (Multiple selection with checkboxes + Enter)
 *   3. confirm (Yes / No with Enter / Escape)
 *   4. text_input (Text prompt with Enter)
 *   5. number_input (Quantity counter [- N +])
 *   6. file_picker (File upload helper)
 *   7. approval (Security policy review: [A]pprove / [R]eject / [E]dit)
 *   8. waiting (Manual CAPTCHA / user action pause & resume)
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

    setContainer(containerElement) {
      this.container = containerElement;
    }

    /**
     * Helper for approval requests.
     */
    async requestApproval(proposal) {
      return this.renderInteraction({
        type: 'approval',
        question: `Konfirmasi aksi: ${proposal.action_name}`,
        action_name: proposal.action_name,
        parameters: proposal.parameters,
        interaction_id: 'ix_' + Date.now(),
      });
    }

    /**
     * Helper for choice requests.
     */
    async requestChoice(question, options) {
      return this.renderInteraction({
        type: 'choice',
        question,
        options,
        interaction_id: 'ix_' + Date.now(),
      });
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
      const ixId = interaction.interaction_id || ('ix_' + Date.now());

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
        card.scrollIntoView({ behavior: 'smooth', block: 'end' });

        // Bind interactive events & keyboard shortcuts
        this._bindCardEvents(card, interaction, resolve);

        // Auto-focus first interactive element or input
        setTimeout(() => {
          const firstInput = card.querySelector('input, textarea');
          if (firstInput) {
            firstInput.focus();
          } else {
            card.focus();
          }
        }, 60);
      });
    }

    _renderChoiceHtml(ix) {
      const options = (ix.options || []).map((opt, i) => {
        if (typeof opt === 'string') {
          return { id: opt, label: opt, index: i + 1 };
        }
        return {
          id: opt.id || opt.value || opt.label || String(i + 1),
          label: opt.label || opt.name || opt.text || String(opt),
          description: opt.description || '',
          index: i + 1,
        };
      });

      return `
        <div class="widget-header">
          <div class="widget-icon-pill choice">
            <span class="material-symbols-outlined" style="font-size:15px">help</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Pilih salah satu opsi:')}</div>
        </div>
        ${ix.description ? `<div class="widget-desc">${this._esc(ix.description)}</div>` : ''}
        <div class="widget-options-list" role="radiogroup">
          ${options.map((opt) => `
            <button class="widget-choice-btn" data-id="${this._esc(opt.id)}" data-label="${this._esc(opt.label)}" data-key="${opt.index}">
              <span class="choice-key">${opt.index}</span>
              <div class="choice-text-wrap">
                <div class="choice-label">${this._esc(opt.label)}</div>
                ${opt.description ? `<div class="choice-desc">${this._esc(opt.description)}</div>` : ''}
              </div>
              <span class="material-symbols-outlined choice-chevron">chevron_right</span>
            </button>
          `).join('')}
        </div>
        <div class="widget-footer-hint">Tekan angka 1-${Math.min(9, options.length)} pada keyboard atau klik opsi</div>
      `;
    }

    _renderMultiChoiceHtml(ix) {
      const options = ix.options || [];
      return `
        <div class="widget-header">
          <div class="widget-icon-pill multi">
            <span class="material-symbols-outlined" style="font-size:15px">checklist</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Pilih beberapa opsi:')}</div>
        </div>
        <div class="widget-options-list">
          ${options.map((opt, i) => {
            const val = typeof opt === 'object' ? (opt.id || opt.value || opt.label) : opt;
            const lbl = typeof opt === 'object' ? (opt.label || opt.name) : opt;
            return `
              <label class="widget-checkbox-row">
                <input type="checkbox" class="widget-chk" value="${this._esc(val)}" />
                <span class="chk-custom"></span>
                <span class="chk-label">${this._esc(lbl)}</span>
              </label>
            `;
          }).join('')}
        </div>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-submit-multichoice">Lanjutkan (Enter)</button>
        </div>
      `;
    }

    _renderConfirmHtml(ix) {
      return `
        <div class="widget-header">
          <div class="widget-icon-pill confirm">
            <span class="material-symbols-outlined" style="font-size:15px">help_center</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Konfirmasi Tindakan')}</div>
        </div>
        ${ix.description ? `<div class="widget-desc">${this._esc(ix.description)}</div>` : ''}
        <div class="widget-actions">
          <button class="btn-widget-primary btn-confirm-yes">
            <span class="material-symbols-outlined" style="font-size:14px">check</span>
            <span>Ya, Lanjutkan (Enter)</span>
          </button>
          <button class="btn-widget-ghost btn-confirm-no">
            <span class="material-symbols-outlined" style="font-size:14px">close</span>
            <span>Batal (Esc)</span>
          </button>
        </div>
      `;
    }

    _renderTextInputHtml(ix) {
      return `
        <div class="widget-header">
          <div class="widget-icon-pill input">
            <span class="material-symbols-outlined" style="font-size:15px">edit_note</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Masukkan Data')}</div>
        </div>
        <div style="margin:8px 0">
          <input type="text" class="widget-text-input widget-text-val" placeholder="${this._esc(ix.description || 'Ketik respon di sini...')}" />
        </div>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-submit-text">
            <span>Kirim Respon (Enter)</span>
          </button>
          <button class="btn-widget-ghost btn-cancel-text">Batal</button>
        </div>
      `;
    }

    _renderNumberInputHtml(ix) {
      return `
        <div class="widget-header">
          <div class="widget-icon-pill number">
            <span class="material-symbols-outlined" style="font-size:15px">pin</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Jumlah')}</div>
        </div>
        <div class="widget-number-box">
          <button class="btn-num-ctrl btn-num-dec">-</button>
          <span class="widget-num-val">1</span>
          <button class="btn-num-ctrl btn-num-inc">+</button>
        </div>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-submit-number">Lanjutkan (Enter)</button>
        </div>
      `;
    }

    _renderFilePickerHtml(ix) {
      return `
        <div class="widget-header">
          <div class="widget-icon-pill file">
            <span class="material-symbols-outlined" style="font-size:15px">upload_file</span>
          </div>
          <div class="widget-title">${this._esc(ix.question || 'Pilih Berkas')}</div>
        </div>
        <div style="margin:8px 0">
          <input type="file" class="widget-file-input" />
        </div>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-submit-file">Upload &amp; Lanjut</button>
        </div>
      `;
    }

    _renderApprovalHtml(ix) {
      const actionName = ix.action_name || 'Tindakan Sensitif';
      const paramsStr = JSON.stringify(ix.parameters || {}, null, 2);
      return `
        <div class="widget-header">
          <div class="widget-icon-pill approval">
            <span class="material-symbols-outlined" style="font-size:15px">shield</span>
          </div>
          <div class="widget-title">Review Diperlukan</div>
        </div>
        <div class="widget-desc">Agent mengusulkan tindakan: <strong style="color:var(--foreground,#f4f4f5)">${this._esc(actionName)}</strong></div>
        <pre class="widget-code-preview">${this._esc(paramsStr)}</pre>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-approve" title="Shortkey: A">
            <span class="material-symbols-outlined" style="font-size:14px">check</span> Setujui (A)
          </button>
          <button class="btn-widget-ghost btn-reject" style="color:#ef4444" title="Shortkey: R">
            <span class="material-symbols-outlined" style="font-size:14px">close</span> Tolak (R)
          </button>
          <button class="btn-widget-ghost btn-edit" title="Shortkey: E">
            <span class="material-symbols-outlined" style="font-size:14px">edit</span> Ubah (E)
          </button>
        </div>
      `;
    }

    _renderWaitingHtml(ix) {
      return `
        <div class="widget-header">
          <div class="widget-icon-pill waiting">
            <span class="material-symbols-outlined" style="font-size:15px">hourglass_empty</span>
          </div>
          <div class="widget-title">Menunggu Tindakan Manual</div>
        </div>
        <div class="widget-desc">${this._esc(ix.question || 'Silakan selesaikan aksi / CAPTCHA di tab browser Edge.')}</div>
        <div class="widget-actions">
          <button class="btn-widget-primary btn-waiting-done">
            <span class="material-symbols-outlined" style="font-size:14px">check</span> Selesai, Lanjutkan (Enter)
          </button>
          <button class="btn-widget-ghost btn-waiting-cancel">Batalkan</button>
        </div>
      `;
    }

    _bindCardEvents(card, ix, resolve) {
      let isResolved = false;

      const transitionToResolved = (displayLabel) => {
        if (isResolved) return;
        isResolved = true;

        card.innerHTML = `
          <div class="widget-resolved-status">
            <span class="material-symbols-outlined" style="font-size:16px;color:#22c55e">check_circle</span>
            <div style="flex:1">
              <span style="color:#a1a1aa">Respon dikirim:</span>
              <strong style="color:#f4f4f5;margin-left:4px">${this._esc(displayLabel)}</strong>
            </div>
            <span class="widget-loading-pulse">Sedang memproses...</span>
          </div>
        `;
        card.classList.add('resolved');
      };

      const resolveAndSubmit = (val, displayLabel, meta = {}) => {
        if (isResolved) return;
        transitionToResolved(displayLabel || String(val));

        if (this.interactionManager) {
          this.interactionManager.submitResponse(ix.interaction_id, val, meta);
        }
        resolve({ approved: val !== false && val !== 'reject', value: val, label: displayLabel, ...meta });
      };

      const rejectAndSubmit = (reason = 'Dibatalkan oleh pengguna') => {
        if (isResolved) return;
        transitionToResolved('Dibatalkan');

        if (this.interactionManager) {
          this.interactionManager.cancelInteraction(ix.interaction_id, reason);
        }
        resolve({ approved: false, value: 'reject', feedback: reason });
      };

      // Choice buttons
      card.querySelectorAll('.widget-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          resolveAndSubmit(btn.dataset.id, btn.dataset.label || btn.dataset.id);
        });
      });

      // Multi choice
      const btnMulti = card.querySelector('.btn-submit-multichoice');
      if (btnMulti) {
        btnMulti.addEventListener('click', () => {
          const selected = Array.from(card.querySelectorAll('.widget-chk:checked')).map((c) => c.value);
          resolveAndSubmit(selected, selected.join(', '));
        });
      }

      // Confirm Yes/No
      const btnYes = card.querySelector('.btn-confirm-yes');
      const btnNo = card.querySelector('.btn-confirm-no');
      if (btnYes) btnYes.addEventListener('click', () => resolveAndSubmit(true, 'Ya'));
      if (btnNo) btnNo.addEventListener('click', () => resolveAndSubmit(false, 'Tidak'));

      // Text input
      const btnText = card.querySelector('.btn-submit-text');
      const inpText = card.querySelector('.widget-text-val');
      if (btnText && inpText) {
        const doSubmitText = () => {
          const val = inpText.value.trim();
          if (val) resolveAndSubmit(val, val);
        };
        btnText.addEventListener('click', doSubmitText);
        inpText.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') doSubmitText();
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
        btnNumSubmit.addEventListener('click', () => resolveAndSubmit(currentNum, String(currentNum)));
      }

      // Approval (A / R / E)
      const btnApprove = card.querySelector('.btn-approve');
      const btnReject = card.querySelector('.btn-reject');
      const btnEdit = card.querySelector('.btn-edit');
      if (btnApprove) btnApprove.addEventListener('click', () => resolveAndSubmit('approve', 'Disetujui', { approved: true }));
      if (btnReject) {
        btnReject.addEventListener('click', () => {
          const fb = prompt('Alasan penolakan / instruksi alternatif:', 'Tindakan dibatalkan oleh pengguna.');
          resolveAndSubmit('reject', 'Ditolak', { approved: false, feedback: fb || 'Rejected' });
        });
      }
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          const newInstr = prompt('Edit instruksi:', ix.question || '');
          resolveAndSubmit('edit', 'Diedit', { approved: false, feedback: newInstr || 'Edit requested' });
        });
      }

      // Waiting (Done / Cancel)
      const btnDone = card.querySelector('.btn-waiting-done');
      const btnWaitCancel = card.querySelector('.btn-waiting-cancel');
      if (btnDone) btnDone.addEventListener('click', () => resolveAndSubmit('done', 'Selesai Manual'));
      if (btnWaitCancel) btnWaitCancel.addEventListener('click', () => rejectAndSubmit('Waiting cancelled'));

      // Keyboard handler (1..9 numbers for choice, and shortcuts)
      const onKeyDown = (e) => {
        if (isResolved) {
          window.removeEventListener('keydown', onKeyDown);
          return;
        }

        // Numbers 1-9 for choices
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9 && document.activeElement?.tagName !== 'INPUT') {
          const matchingBtn = card.querySelector(`.widget-choice-btn[data-key="${num}"]`);
          if (matchingBtn) {
            e.preventDefault();
            matchingBtn.click();
            return;
          }
        }

        if (e.key === 'a' || e.key === 'A') {
          if (btnApprove && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); btnApprove.click(); }
        } else if (e.key === 'r' || e.key === 'R') {
          if (btnReject && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); btnReject.click(); }
        } else if (e.key === 'Enter') {
          if (btnYes) { e.preventDefault(); btnYes.click(); }
          else if (btnDone) { e.preventDefault(); btnDone.click(); }
        } else if (e.key === 'Escape') {
          if (btnNo) { e.preventDefault(); btnNo.click(); }
        }
      };

      window.addEventListener('keydown', onKeyDown);
    }

    clear() {
      if (this.currentCard && !this.currentCard.classList.contains('resolved')) {
        this.currentCard.remove();
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
