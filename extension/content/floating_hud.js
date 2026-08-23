/**
 * Deep Browser Extension — In-Page Floating Dynamic Island / HUD Widget
 * =====================================================================
 * Injected directly into Microsoft Edge pages:
 *   - Collapsed: Sleek floating pill / island with drag handle (⠿) matching screenshot
 *   - Expanded: Fully resizable HUD card (Event log, reasoning, actions, widgets, prompt, send & stop)
 *   - Size & position auto-saved in chrome.storage.local
 *   - Full bidirectional synchronization with agent runtime in SidePanel
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('deep-browser-floating-hud')) return;

  const hudContainer = document.createElement('div');
  hudContainer.id = 'deep-browser-floating-hud';

  hudContainer.innerHTML = `
    <!-- 1. Collapsed State: Dynamic Island Pill -->
    <div class="db-hud-pill" id="db-pill">
      <div class="db-drag-handle" id="db-pill-drag" title="Geser posisi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      <div class="db-status-dot" id="db-pill-dot"></div>
      <span class="db-hud-title">Deep Browser</span>
      <span class="db-hud-status-badge" id="db-pill-status">Siap</span>
      <button class="db-icon-btn" id="db-btn-expand-pill" title="Buka Kontrol Agent" style="margin-left:2px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </div>

    <!-- 2. Expanded State: Resizable Floating HUD Card -->
    <div class="db-hud-card" id="db-card">
      <!-- Header -->
      <div class="db-hud-card-header" id="db-card-drag">
        <div class="db-hud-header-left">
          <div class="db-drag-handle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="db-status-dot" id="db-card-dot"></div>
          <span class="db-hud-title">Deep Browser</span>
          <span class="db-hud-status-badge" id="db-card-status">Siap</span>
        </div>
        <div class="db-hud-header-right">
          <button class="db-icon-btn" id="db-btn-collapse" title="Minimize ke Pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button class="db-icon-btn" id="db-btn-close-hud" title="Sembunyikan">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Body: Interactive Widgets & Event Log -->
      <div class="db-hud-body" id="db-hud-body">
        <div id="db-hud-widget-mount"></div>
        <div id="db-hud-timeline"></div>
      </div>

      <!-- Footer: Prompt Bar & Stop/Send Button -->
      <div class="db-hud-footer">
        <div class="db-hud-input-row">
          <input type="text" class="db-hud-input" id="db-hud-prompt" placeholder="Perintahkan agent di halaman ini..." />
          <button class="db-hud-send-btn" id="db-hud-btn-send" disabled title="Kirim">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(hudContainer);

  // References
  const elPill          = document.getElementById('db-pill');
  const elCard          = document.getElementById('db-card');
  const elPillStatus    = document.getElementById('db-pill-status');
  const elCardStatus    = document.getElementById('db-card-status');
  const elPillDot       = document.getElementById('db-pill-dot');
  const elCardDot       = document.getElementById('db-card-dot');
  const elTimeline      = document.getElementById('db-hud-timeline');
  const elWidgetMount   = document.getElementById('db-hud-widget-mount');
  const elPromptInput   = document.getElementById('db-hud-prompt');
  const elBtnSend       = document.getElementById('db-hud-btn-send');
  const elBtnExpandPill = document.getElementById('db-btn-expand-pill');
  const elBtnCollapse   = document.getElementById('db-btn-collapse');
  const elBtnClose      = document.getElementById('db-btn-close-hud');

  let isRunning = false;
  let isWaiting = false;
  let currentThoughtBody = null;
  let currentThoughtHeader = null;
  let stepStartTime = 0;

  // ─── Expand & Collapse State ───────────────────────────────────────────────
  function expandCard() {
    elPill.style.display = 'none';
    elCard.style.display = 'flex';
    elPromptInput.focus();
  }

  function collapseToPill() {
    elCard.style.display = 'none';
    elPill.style.display = 'flex';
  }

  elPill.addEventListener('click', (e) => {
    if (e.target.closest('#db-pill-drag')) return;
    expandCard();
  });

  elBtnExpandPill.addEventListener('click', (e) => {
    e.stopPropagation();
    expandCard();
  });

  elBtnCollapse.addEventListener('click', collapseToPill);
  elBtnClose.addEventListener('click', () => {
    hudContainer.style.display = 'none';
  });

  // ─── Prompt Submission & Stop Controls ─────────────────────────────────────
  elPromptInput.addEventListener('input', () => {
    if (!isRunning) {
      elBtnSend.disabled = !elPromptInput.value.trim();
    }
  });

  elPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isRunning) {
        stopTask();
      } else if (!elBtnSend.disabled) {
        submitPrompt();
      }
    }
  });

  elBtnSend.addEventListener('click', () => {
    if (isRunning) {
      stopTask();
    } else {
      submitPrompt();
    }
  });

  function submitPrompt() {
    const goal = elPromptInput.value.trim();
    if (!goal) return;

    appendUserMessage(goal);
    elPromptInput.value = '';
    setStatus('Bekerja...', true, false);

    stepStartTime = Date.now();

    // Trigger task execution in SidePanel / background
    chrome.runtime?.sendMessage?.({ action: 'START_TASK_FROM_HUD', task: goal }, (res) => {
      // Optional ack
    });
  }

  function stopTask() {
    setStatus('Dihentikan', false, false);
    appendResult('Agent dihentikan oleh pengguna.', true);

    chrome.runtime?.sendMessage?.({ action: 'STOP_TASK_FROM_HUD' }, (res) => {
      // Optional ack
    });
  }

  // ─── Status Updates ────────────────────────────────────────────────────────
  function setStatus(text, running, waiting = false) {
    isRunning = running;
    isWaiting = waiting;

    elPillStatus.textContent = text;
    elCardStatus.textContent = text;

    const dotClass = waiting ? 'waiting' : running ? 'running' : '';
    elPillDot.className = 'db-status-dot ' + dotClass;
    elCardDot.className = 'db-status-dot ' + dotClass;

    if (running) {
      elBtnSend.disabled = false;
      elBtnSend.classList.add('running');
      elBtnSend.title = 'Hentikan Agent';
      elBtnSend.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
    } else {
      elBtnSend.classList.remove('running');
      elBtnSend.title = 'Kirim';
      elBtnSend.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
      elBtnSend.disabled = !elPromptInput.value.trim();
    }
  }

  // ─── Streamlined Event Log In HUD ──────────────────────────────────────────
  function appendUserMessage(text) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:6px 8px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.25);border-radius:6px;font-size:11px;color:#f4f4f5;margin-bottom:4px';
    div.textContent = text;
    elTimeline.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendReasoning(text) {
    ensureThoughtContainer();
    const div = document.createElement('div');
    div.className = 'db-hud-thought-text';
    div.textContent = text;
    currentThoughtBody.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendAction(actionText, codeDetail = '') {
    ensureThoughtContainer();
    const div = document.createElement('div');
    div.className = 'db-hud-action-item';
    div.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      <span>${esc(actionText)}</span>
      ${codeDetail ? `<span class="db-hud-action-code">${esc(codeDetail)}</span>` : ''}
    `;
    currentThoughtBody.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendResult(resultText, isError = false) {
    if (currentThoughtHeader) {
      const elapsed = Math.max(1, Math.round((Date.now() - (stepStartTime || Date.now())) / 1000));
      currentThoughtHeader.querySelector('.db-thought-label').textContent = `Worked for ${elapsed}s`;
      currentThoughtBody.classList.remove('open');
    }

    const div = document.createElement('div');
    div.className = 'db-hud-result-box';
    if (isError) {
      div.style.background = 'rgba(239, 68, 68, 0.08)';
      div.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    }
    div.innerHTML = `<strong style="color:${isError ? '#ef4444' : '#22c55e'}">${isError ? 'Gagal' : 'Hasil'}:</strong> ${esc(resultText)}`;
    elTimeline.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });

    currentThoughtBody = null;
    currentThoughtHeader = null;
    setStatus('Siap', false, false);
  }

  function ensureThoughtContainer() {
    if (currentThoughtBody) return;

    const wrap = document.createElement('div');
    wrap.className = 'db-hud-thought-wrap';

    const header = document.createElement('div');
    header.className = 'db-hud-thought-header';
    header.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      <span class="db-thought-label">Sedang memproses...</span>
    `;

    const body = document.createElement('div');
    body.className = 'db-hud-thought-body open';

    header.addEventListener('click', () => {
      body.classList.toggle('open');
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    elTimeline.appendChild(wrap);

    currentThoughtBody = body;
    currentThoughtHeader = header;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ─── Realtime Event Listener ───────────────────────────────────────────────
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (!msg) return;

    if (msg.type === 'SHOW_FLOATING_HUD') {
      hudContainer.style.display = 'block';
      expandCard();
    }

    if (msg.event_type) {
      const t = msg.event_type;
      const m = msg.message;
      const d = msg.data || {};

      if (t === 'TASK_STARTED') {
        stepStartTime = Date.now();
        setStatus('Bekerja...', true, false);
      } else if (t === 'REASONING') {
        appendReasoning(m);
      } else if (t === 'CLICK') {
        appendAction(`Click [${d.index || ''}] ${d.target || ''}`);
      } else if (t === 'TYPE') {
        appendAction(`Type "${d.text || ''}" into [${d.index || ''}]`);
      } else if (t === 'NAVIGATION') {
        appendAction(`Navigate to ${d.url || m}`);
      } else if (t === 'SCROLL') {
        appendAction(`Scroll ${d.down !== false ? 'down' : 'up'}`);
      } else if (t === 'EXTRACTION') {
        appendAction(`Extract data:`, d.query || '');
      } else if (t === 'USER_INPUT_REQUIRED') {
        setStatus('Menunggu Anda', false, true);
        renderInteractiveWidgetInHud(d.interaction || { type: d.type, question: d.question, options: d.options });
      } else if (t === 'TASK_COMPLETED') {
        appendResult(d.result || m || 'Tugas selesai.');
      } else if (t === 'ERROR') {
        appendResult(d.error || m, true);
      } else if (t === 'TASK_CANCELLED') {
        appendResult(m || 'Agent dihentikan.', true);
      }
    }
  });

  // ─── Interactive Widgets In Floating HUD ───────────────────────────────────
  function renderInteractiveWidgetInHud(ix) {
    elWidgetMount.innerHTML = '';
    const type = ix.type || 'confirm';

    const card = document.createElement('div');
    card.style.cssText = 'padding:8px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.35);border-radius:8px;margin-bottom:6px;font-size:11px';

    card.innerHTML = `
      <div style="font-weight:600;color:#f59e0b;margin-bottom:4px">${esc(ix.question || 'Konfirmasi Tindakan')}</div>
      ${
        type === 'choice'
          ? `<div style="display:flex;flex-direction:column;gap:3px">
              ${(ix.options || []).map((o, idx) => `
                <button class="db-hud-opt-btn" data-id="${esc(o.id || o.value || o)}" style="padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#f4f4f5;cursor:pointer;text-align:left;font-size:10.5px">
                  ${idx + 1}. ${esc(o.label || o.name || o)}
                </button>
              `).join('')}
            </div>`
          : `<div style="display:flex;gap:4px;margin-top:4px">
              <button class="db-hud-btn-yes" style="padding:4px 8px;border-radius:4px;background:#8b5cf6;border:none;color:white;cursor:pointer;font-size:10.5px;font-weight:500">Ya, Lanjutkan</button>
              <button class="db-hud-btn-no" style="padding:4px 8px;border-radius:4px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:#a1a1aa;cursor:pointer;font-size:10.5px">Batal</button>
            </div>`
      }
    `;

    card.querySelectorAll('.db-hud-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        respondInteraction(btn.dataset.id);
      });
    });

    const btnYes = card.querySelector('.db-hud-btn-yes');
    const btnNo = card.querySelector('.db-hud-btn-no');
    if (btnYes) btnYes.addEventListener('click', () => respondInteraction(true));
    if (btnNo) btnNo.addEventListener('click', () => respondInteraction(false));

    elWidgetMount.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function respondInteraction(value) {
    elWidgetMount.innerHTML = '';
    setStatus('Bekerja...', true, false);
    chrome.runtime?.sendMessage?.({ action: 'RESOLVE_INTERACTION_FROM_HUD', value });
  }

  // ─── Dragging & Position Persistence ───────────────────────────────────────
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initLeft = 0;
  let initTop = 0;

  function initDrag(handleEl) {
    handleEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = hudContainer.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      hudContainer.style.bottom = 'auto';
      hudContainer.style.right = 'auto';
      hudContainer.style.left = initLeft + 'px';
      hudContainer.style.top = initTop + 'px';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const newLeft = Math.max(10, Math.min(window.innerWidth - hudContainer.offsetWidth - 10, initLeft + deltaX));
    const newTop = Math.max(10, Math.min(window.innerHeight - hudContainer.offsetHeight - 10, initTop + deltaY));

    hudContainer.style.left = newLeft + 'px';
    hudContainer.style.top = newTop + 'px';
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const pos = { left: hudContainer.style.left, top: hudContainer.style.top };
    chrome.storage?.local?.set({ db_floating_hud_pos: pos });
  }

  initDrag(document.getElementById('db-pill-drag'));
  initDrag(document.getElementById('db-card-drag'));

  // ─── Resizing & Size Persistence ───────────────────────────────────────────
  if (window.ResizeObserver) {
    let resizeTimer = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === elCard && elCard.style.display !== 'none') {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const width = elCard.offsetWidth;
            const height = elCard.offsetHeight;
            if (width > 200 && height > 150) {
              chrome.storage?.local?.set({ db_floating_hud_size: { width, height } });
            }
          }, 300);
        }
      }
    });
    observer.observe(elCard);
  }

  // Restore saved position and size
  chrome.storage?.local?.get(['db_floating_hud_pos', 'db_floating_hud_size'], (res) => {
    if (res?.db_floating_hud_pos) {
      hudContainer.style.bottom = 'auto';
      hudContainer.style.right = 'auto';
      hudContainer.style.left = res.db_floating_hud_pos.left;
      hudContainer.style.top = res.db_floating_hud_pos.top;
    }
    if (res?.db_floating_hud_size) {
      elCard.style.width = res.db_floating_hud_size.width + 'px';
      elCard.style.height = res.db_floating_hud_size.height + 'px';
    }
  });

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
