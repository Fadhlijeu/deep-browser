/**
 * Deep Browser Extension — World-Class Floating Command HUD & Dynamic Island
 * ===========================================================================
 * Master Controller:
 * - Dynamic Island Pill & Command HUD Window
 * - Smooth Drag & Drop with Viewport Boundaries
 * - Reliable Close / Minimize / Show Controls (.db-hidden class toggle)
 * - Quick Action Widgets & Interactive HITL Widget Mount
 * - Bidirectional Agent Execution & Instant Stop
 */

(function() {
  'use strict';

  // Prevent duplicate instances
  if (document.getElementById('deep-browser-floating-hud')) return;

  const hudHost = document.createElement('div');
  hudHost.id = 'deep-browser-floating-hud';

  hudHost.innerHTML = `
    <!-- 1. DYNAMIC ISLAND PILL (Collapsed State) -->
    <div class="db-island-pill" id="db-island-pill">
      <div class="db-drag-grip" id="db-pill-drag-grip" title="Geser posisi">
        <svg class="db-svg-icon" viewBox="0 0 24 24">
          <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      <div class="db-live-status-dot" id="db-pill-dot"></div>
      <span class="db-pill-brand">Deep Browser</span>
      <span class="db-pill-status-label" id="db-pill-status">Siap</span>
      <span class="db-pill-ticker" id="db-pill-ticker"></span>
      <div class="db-pill-actions">
        <button class="db-control-btn" id="db-btn-pill-expand" title="Buka Command HUD">
          <svg class="db-svg-icon" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <button class="db-control-btn close-btn" id="db-btn-pill-close" title="Tutup Floating">
          <svg class="db-svg-icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- 2. COMMAND HUD WINDOW (Expanded State) -->
    <div class="db-hud-window" id="db-hud-window">
      <!-- Window Header -->
      <div class="db-window-header" id="db-window-drag-bar">
        <div class="db-header-title-box">
          <div class="db-drag-grip" title="Geser jendela">
            <svg class="db-svg-icon" viewBox="0 0 24 24">
              <circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="db-live-status-dot" id="db-win-dot"></div>
          <span class="db-window-title">Deep Browser Copilot</span>
          <span class="db-header-badge" id="db-win-status">Siap</span>
        </div>
        <div class="db-window-controls">
          <button class="db-control-btn" id="db-btn-win-minimize" title="Minimize ke Island Pill (Esc)">
            <svg class="db-svg-icon" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button class="db-control-btn close-btn" id="db-btn-win-close" title="Tutup Floating (✕)">
            <svg class="db-svg-icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Window Body (Activity Stream & Widgets) -->
      <div class="db-window-body" id="db-win-body">
        <!-- Interactive HITL Widget Container -->
        <div id="db-win-widgets"></div>

        <!-- Quick Action Widgets (Visible when idle) -->
        <div class="db-quick-widgets-container" id="db-quick-widgets">
          <div class="db-quick-widgets-title">
            <svg class="db-svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            <span>Aksi Cepat &amp; Widget</span>
          </div>
          <div class="db-quick-widgets-grid">
            <button class="db-quick-chip" data-prompt="Cari data di PDDIKTI lalu ambil informasi lengkapnya">
              <span>Cari PDDIKTI</span>
              <svg class="db-svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button class="db-quick-chip" data-prompt="Rangkum konten halaman aktif ini dan jelaskan poin-poin intinya">
              <span>Ringkas Halaman</span>
              <svg class="db-svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button class="db-quick-chip" data-prompt="Lakukan riset multi-tab komprehensif mengenai topik ini">
              <span>Riset Multi-Tab</span>
              <svg class="db-svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button class="db-quick-chip" id="db-btn-demo-widget">
              <span style="color:#f59e0b">Demo Widget Interaktif</span>
              <svg class="db-svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;stroke:#f59e0b"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </button>
          </div>
        </div>

        <!-- Activity Timeline Stream -->
        <div id="db-win-timeline"></div>
      </div>

      <!-- Window Footer (Prompt Bar & Actions) -->
      <div class="db-window-footer">
        <div class="db-prompt-box-wrap">
          <input type="text" class="db-prompt-input" id="db-prompt-input" placeholder="Perintahkan agent di halaman ini (contoh: cari data, isi form)..." />
          <button class="db-btn-dispatch" id="db-btn-dispatch" disabled title="Kirim Perintah (Enter)">
            <svg class="db-svg-icon" id="db-dispatch-icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(hudHost);

  // References
  const elPill          = document.getElementById('db-island-pill');
  const elWindow        = document.getElementById('db-hud-window');
  const elPillDot       = document.getElementById('db-pill-dot');
  const elWinDot        = document.getElementById('db-win-dot');
  const elPillStatus    = document.getElementById('db-pill-status');
  const elWinStatus     = document.getElementById('db-win-status');
  const elPillTicker    = document.getElementById('db-pill-ticker');
  const elTimeline      = document.getElementById('db-win-timeline');
  const elWidgetsMount  = document.getElementById('db-win-widgets');
  const elQuickWidgets  = document.getElementById('db-quick-widgets');
  const elPromptInput   = document.getElementById('db-prompt-input');
  const elBtnDispatch   = document.getElementById('db-btn-dispatch');
  const elDispatchIcon  = document.getElementById('db-dispatch-icon');
  const elBtnExpand     = document.getElementById('db-btn-pill-expand');
  const elBtnPillClose  = document.getElementById('db-btn-pill-close');
  const elBtnMinimize   = document.getElementById('db-btn-win-minimize');
  const elBtnClose      = document.getElementById('db-btn-win-close');
  const elBtnDemoWidget = document.getElementById('db-btn-demo-widget');

  let isAgentRunning = false;
  let isWaitingUser = false;
  let activeStepAccordion = null;
  let activeStepBody = null;
  let currentStepStartTime = 0;
  let stepCounter = 0;

  // ─── Mode Switching (Island Pill <-> Command HUD) ───────────────────────────
  function openCommandHUD() {
    hudHost.classList.remove('db-hidden');
    elPill.style.display = 'none';
    elWindow.style.display = 'flex';
    elPromptInput.focus();
  }

  function minimizeToPill() {
    hudHost.classList.remove('db-hidden');
    elWindow.style.display = 'none';
    elPill.style.display = 'flex';
  }

  function hideFloatingHUD() {
    hudHost.classList.add('db-hidden');
    chrome.storage?.local?.set({ db_floating_hud_hidden: true });
  }

  function showFloatingHUD() {
    hudHost.classList.remove('db-hidden');
    chrome.storage?.local?.set({ db_floating_hud_hidden: false });
    openCommandHUD();
  }

  elPill.addEventListener('click', (e) => {
    if (e.target.closest('#db-pill-drag-grip') || e.target.closest('#db-btn-pill-close')) return;
    openCommandHUD();
  });

  elBtnExpand.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommandHUD();
  });

  elBtnPillClose.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatingHUD();
  });

  elBtnMinimize.addEventListener('click', minimizeToPill);
  elBtnClose.addEventListener('click', hideFloatingHUD);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elWindow.style.display === 'flex') {
        minimizeToPill();
      }
    }
  });

  // ─── Quick Action Chips ───────────────────────────────────────────────────
  document.querySelectorAll('.db-quick-chip[data-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      elPromptInput.value = prompt;
      elBtnDispatch.disabled = false;
      handleDispatchClick();
    });
  });

  if (elBtnDemoWidget) {
    elBtnDemoWidget.addEventListener('click', () => {
      renderHITLWidget({
        type: 'choice',
        question: 'Demo Widget Interaktif: Pilih opsi tindakan yang ingin dijalankan:',
        options: [
          { id: 'opt_1', label: 'Lanjutkan jelajah halaman secara otonom' },
          { id: 'opt_2', label: 'Ekstrak tabel dan download data sebagai CSV' },
          { id: 'opt_3', label: 'Konfirmasi review sebelum submit' },
        ],
      });
    });
  }

  // ─── Prompt Submission & Stop Controller ───────────────────────────────────
  elPromptInput.addEventListener('input', () => {
    if (!isAgentRunning) {
      elBtnDispatch.disabled = !elPromptInput.value.trim();
    }
  });

  elPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleDispatchClick();
    }
  });

  elBtnDispatch.addEventListener('click', handleDispatchClick);

  function handleDispatchClick() {
    if (isAgentRunning) {
      stopCurrentTask();
    } else {
      startNewTask();
    }
  }

  function startNewTask() {
    const goal = elPromptInput.value.trim();
    if (!goal) return;

    if (elQuickWidgets) elQuickWidgets.style.display = 'none';

    appendUserQuery(goal);
    elPromptInput.value = '';
    setTaskRunningState(true);

    currentStepStartTime = Date.now();
    stepCounter = 0;

    // Send task message to SidePanel / background
    chrome.runtime?.sendMessage?.({ action: 'START_TASK_FROM_HUD', task: goal });
  }

  function stopCurrentTask() {
    setTaskRunningState(false);
    updateStatusBadge('Dihentikan', false, false);
    appendResultCard('Agent dihentikan oleh pengguna.', true);

    chrome.runtime?.sendMessage?.({ action: 'STOP_TASK_FROM_HUD' });
  }

  // ─── Status & State Management ─────────────────────────────────────────────
  function updateStatusBadge(text, running, waiting = false) {
    isAgentRunning = running;
    isWaitingUser = waiting;

    elPillStatus.textContent = text;
    elWinStatus.textContent = text;

    const badgeClass = waiting ? 'waiting' : running ? 'running' : '';
    elWinStatus.className = 'db-header-badge ' + badgeClass;

    const dotClass = waiting ? 'waiting' : running ? 'running' : '';
    elPillDot.className = 'db-live-status-dot ' + dotClass;
    elWinDot.className = 'db-live-status-dot ' + dotClass;

    if (running) {
      elBtnDispatch.disabled = false;
      elBtnDispatch.classList.add('running');
      elBtnDispatch.title = 'Hentikan Agent (Enter)';
      elDispatchIcon.innerHTML = `<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>`;
    } else {
      elBtnDispatch.classList.remove('running');
      elBtnDispatch.title = 'Kirim Perintah (Enter)';
      elDispatchIcon.innerHTML = `<path d="M5 12h14M12 5l7 7-7 7"/>`;
      elBtnDispatch.disabled = !elPromptInput.value.trim();
      elPillTicker.style.display = 'none';
    }
  }

  function setTaskRunningState(running) {
    updateStatusBadge(running ? 'Bekerja...' : 'Siap', running, false);
  }

  // ─── Activity Stream (Collapsible Steps & Action Badges) ────────────────────
  function appendUserQuery(text) {
    const card = document.createElement('div');
    card.className = 'db-user-query-card';
    card.textContent = text;
    elTimeline.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function ensureStepAccordion() {
    if (activeStepBody) return;

    stepCounter++;
    const wrap = document.createElement('div');
    wrap.className = 'db-step-accordion';

    const header = document.createElement('div');
    header.className = 'db-step-header open';
    header.innerHTML = `
      <div class="db-step-header-left">
        <svg class="db-svg-icon db-step-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
        <span class="db-step-label">Langkah ${stepCounter} · Memproses...</span>
      </div>
      <span class="db-header-badge" style="font-size:9.5px">Step ${stepCounter}</span>
    `;

    const body = document.createElement('div');
    body.className = 'db-step-body open';

    header.addEventListener('click', () => {
      header.classList.toggle('open');
      body.classList.toggle('open');
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    elTimeline.appendChild(wrap);

    activeStepAccordion = header;
    activeStepBody = body;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendReasoningThought(text) {
    ensureStepAccordion();
    const div = document.createElement('div');
    div.className = 'db-thought-box';
    div.textContent = text;
    activeStepBody.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendActionTelemetry(typePill, typeClass, detailText) {
    ensureStepAccordion();

    // Show mini ticker on collapsed pill
    elPillTicker.style.display = 'inline-block';
    elPillTicker.textContent = `${typePill}: ${detailText}`;

    const row = document.createElement('div');
    row.className = 'db-action-row';
    row.innerHTML = `
      <span class="db-action-type-pill ${typeClass}">${typePill}</span>
      <span class="db-action-detail">${esc(detailText)}</span>
    `;
    activeStepBody.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendResultCard(resultText, isError = false) {
    if (activeStepAccordion) {
      const elapsed = Math.max(1, Math.round((Date.now() - (currentStepStartTime || Date.now())) / 1000));
      activeStepAccordion.querySelector('.db-step-label').textContent = `Selesai dalam ${elapsed}s`;
      activeStepAccordion.classList.remove('open');
      activeStepBody?.classList.remove('open');
    }

    const card = document.createElement('div');
    card.className = 'db-final-result-card' + (isError ? ' error' : '');

    card.innerHTML = `
      <div class="db-result-title">
        <span style="color:${isError ? '#ef4444' : '#22c55e'}">${isError ? 'Gagal Dieksekusi' : 'Hasil Penyelesaian'}</span>
        <button class="db-control-btn btn-copy-result" title="Salin Hasil" style="width:20px;height:20px">
          <svg class="db-svg-icon" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>
      <div>${esc(resultText)}</div>
    `;

    card.querySelector('.btn-copy-result').addEventListener('click', () => {
      navigator.clipboard?.writeText?.(resultText);
    });

    elTimeline.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });

    activeStepAccordion = null;
    activeStepBody = null;
    setTaskRunningState(false);
  }

  // ─── Realtime Event Listener from Agent Runtime ────────────────────────────
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (!msg) return;

    if (msg.type === 'SHOW_FLOATING_HUD') {
      showFloatingHUD();
    }

    if (msg.event_type) {
      const t = msg.event_type;
      const m = msg.message || '';
      const d = msg.data || {};

      if (t === 'TASK_STARTED') {
        currentStepStartTime = Date.now();
        setTaskRunningState(true);
        if (elQuickWidgets) elQuickWidgets.style.display = 'none';
      } else if (t === 'REASONING') {
        appendReasoningThought(m);
      } else if (t === 'CLICK') {
        appendActionTelemetry('CLICK', 'click', `[${d.index || ''}] ${d.target || ''}`);
      } else if (t === 'TYPE') {
        appendActionTelemetry('TYPE', 'type', `"${d.text || ''}" ke [${d.index || ''}]`);
      } else if (t === 'NAVIGATION') {
        appendActionTelemetry('NAV', 'nav', d.url || m);
      } else if (t === 'SCROLL') {
        appendActionTelemetry('SCROLL', 'scroll', d.down !== false ? 'Bawah' : 'Atas');
      } else if (t === 'EXTRACTION') {
        appendActionTelemetry('EXTRACT', 'extract', d.query || 'Target data');
      } else if (t === 'USER_INPUT_REQUIRED') {
        updateStatusBadge('Menunggu Anda', false, true);
        renderHITLWidget(d.interaction || { type: d.type, question: d.question, options: d.options });
      } else if (t === 'TASK_COMPLETED') {
        appendResultCard(d.result || m || 'Tugas selesai.');
      } else if (t === 'ERROR') {
        appendResultCard(d.error || m, true);
      } else if (t === 'TASK_CANCELLED') {
        appendResultCard(m || 'Agent dihentikan.', true);
      }
    }
  });

  // ─── Interactive HITL Widget Mount ─────────────────────────────────────────
  function renderHITLWidget(ix) {
    elWidgetsMount.innerHTML = '';
    const type = ix.type || 'confirm';

    const card = document.createElement('div');
    card.className = 'db-hitl-widget-box';

    card.innerHTML = `
      <div class="db-hitl-question">
        <svg class="db-svg-icon" viewBox="0 0 24 24" style="stroke:#f59e0b"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <span>${esc(ix.question || 'Konfirmasi Tindakan')}</span>
      </div>
      ${
        type === 'choice'
          ? `<div class="db-hitl-options-grid">
              ${(ix.options || []).map((o, idx) => `
                <button class="db-hitl-choice-btn" data-id="${esc(o.id || o.value || o)}">
                  <span style="font-family:JetBrains Mono;font-size:10px;color:#a1a1aa">[${idx + 1}]</span>
                  <span>${esc(o.label || o.name || o)}</span>
                </button>
              `).join('')}
            </div>`
          : `<div class="db-hitl-action-buttons">
              <button class="db-btn-approve" id="db-btn-hitl-yes">Ya, Lanjutkan</button>
              <button class="db-btn-reject" id="db-btn-hitl-no">Batal</button>
            </div>`
      }
    `;

    card.querySelectorAll('.db-hitl-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => submitHITLResponse(btn.dataset.id));
    });

    const btnYes = card.querySelector('#db-btn-hitl-yes');
    const btnNo = card.querySelector('#db-btn-hitl-no');
    if (btnYes) btnYes.addEventListener('click', () => submitHITLResponse(true));
    if (btnNo) btnNo.addEventListener('click', () => submitHITLResponse(false));

    elWidgetsMount.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function submitHITLResponse(value) {
    elWidgetsMount.innerHTML = '';
    setTaskRunningState(true);
    chrome.runtime?.sendMessage?.({ action: 'RESOLVE_INTERACTION_FROM_HUD', value });
  }

  // ─── Dragging & Viewport Physics ───────────────────────────────────────────
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initLeft = 0;
  let initTop = 0;

  function initDragHandle(handleEl) {
    handleEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = hudHost.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      hudHost.style.bottom = 'auto';
      hudHost.style.right = 'auto';
      hudHost.style.left = initLeft + 'px';
      hudHost.style.top = initTop + 'px';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const newLeft = Math.max(10, Math.min(window.innerWidth - hudHost.offsetWidth - 10, initLeft + deltaX));
    const newTop = Math.max(10, Math.min(window.innerHeight - hudHost.offsetHeight - 10, initTop + deltaY));

    hudHost.style.left = newLeft + 'px';
    hudHost.style.top = newTop + 'px';
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const pos = { left: hudHost.style.left, top: hudHost.style.top };
    chrome.storage?.local?.set({ db_floating_hud_pos: pos });
  }

  initDragHandle(document.getElementById('db-pill-drag-grip'));
  initDragHandle(document.getElementById('db-window-drag-bar'));

  // ─── Resizing & Auto-Save Dimensions ───────────────────────────────────────
  if (window.ResizeObserver) {
    let resizeTimer = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === elWindow && elWindow.style.display !== 'none') {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const width = elWindow.offsetWidth;
            const height = elWindow.offsetHeight;
            if (width > 240 && height > 180) {
              chrome.storage?.local?.set({ db_floating_hud_size: { width, height } });
            }
          }, 300);
        }
      }
    });
    resizeObserver.observe(elWindow);
  }

  // Restore saved geometry & hidden state
  chrome.storage?.local?.get(['db_floating_hud_pos', 'db_floating_hud_size', 'db_floating_hud_hidden'], (res) => {
    if (res?.db_floating_hud_hidden) {
      hudHost.classList.add('db-hidden');
    }
    if (res?.db_floating_hud_pos) {
      hudHost.style.bottom = 'auto';
      hudHost.style.right = 'auto';
      hudHost.style.left = res.db_floating_hud_pos.left;
      hudHost.style.top = res.db_floating_hud_pos.top;
    }
    if (res?.db_floating_hud_size) {
      elWindow.style.width = res.db_floating_hud_size.width + 'px';
      elWindow.style.height = res.db_floating_hud_size.height + 'px';
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
