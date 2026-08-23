/**
 * Deep Browser Extension — Compact Detached Agent UI Controller
 * =============================================================
 *
 * Implements persistent, shared-state Mini Overlay:
 *   - Synchronized with SidePanel task runtime
 *   - Supports interactive widgets & approval in compact mode
 *   - Draggable & Minimizable
 */

'use strict';

(function() {
  const $ = (id) => document.getElementById(id);
  const elStatusDot        = $('compact-status-dot');
  const elStatusText       = $('compact-status-text');
  const elTimeline         = $('compact-timeline');
  const elWidgetContainer  = $('compact-widget-container');
  const elGoalInput        = $('compact-goal-input');
  const elBtnSend          = $('btn-compact-send');
  const elSendIcon         = $('compact-send-icon');
  const elBtnMinimize      = $('btn-compact-minimize');
  const elBtnRestore       = $('btn-compact-restore');
  const elBtnClose         = $('btn-compact-close');
  const elMinPill          = $('minimized-pill');
  const elBtnMinExpand     = $('btn-min-expand');
  const elCompactBody      = $('compact-body');
  const elCompactFooter    = $('compact-footer');

  let widgetManager = null;
  let interactionManager = null;
  let currentTaskState = 'IDLE';

  async function init() {
    interactionManager = new window.InteractionManager({
      onStateChange: handleStateChange,
      onInteractionEvent: handleInteractionEvent,
    });

    widgetManager = new window.WidgetManager(elWidgetContainer, interactionManager);

    bindEvents();
    loadSharedState();

    // Listen for storage changes from SidePanel / Background
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.active_task_event) {
          handleTaskEvent(changes.active_task_event.newValue);
        }
      }
    });
  }

  function handleStateChange(newState) {
    currentTaskState = newState;
    elStatusText.textContent = newState === 'WAITING_FOR_USER' ? 'Menunggu Anda' : newState === 'RUNNING' ? 'Bekerja' : 'Siap';
    elStatusDot.className = newState === 'WAITING_FOR_USER' ? 'waiting' : newState === 'RUNNING' ? 'running' : '';

    if (newState === 'WAITING_FOR_USER') {
      setRunning(false, 'Waiting');
    } else if (newState === 'RUNNING') {
      setRunning(true, 'Stop');
    } else {
      setRunning(false, 'Send');
    }
  }

  function handleInteractionEvent(evt) {
    if (evt.event === 'USER_INPUT_REQUIRED') {
      widgetManager.renderInteraction(evt.interaction);
    } else if (evt.event === 'INTERACTION_RESOLVED' || evt.event === 'INTERACTION_CANCELLED') {
      widgetManager.clear();
    }
  }

  function handleTaskEvent(evt) {
    if (!evt) return;
    const t = evt.event_type;
    const msg = evt.message;

    if (t === 'REASONING') {
      appendSubItem('psychology', msg);
    } else if (t === 'CLICK' || t === 'TYPE' || t === 'NAVIGATION' || t === 'SCROLL') {
      appendSubItem('touch_app', msg);
    } else if (t === 'TASK_COMPLETED') {
      appendResult(msg, false);
      handleStateChange('DONE');
    } else if (t === 'ERROR') {
      appendResult(msg, true);
      handleStateChange('ERROR');
    }
  }

  function appendSubItem(icon, text) {
    const div = document.createElement('div');
    div.className = 'thought-sub-item';
    div.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:12px">${icon}</span>
      <span>${escHtml(text)}</span>
    `;
    elTimeline.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendResult(text, isError) {
    const div = document.createElement('div');
    div.className = 'chat-agent-result';
    div.style.color = isError ? 'var(--destructive)' : 'var(--success)';
    div.innerHTML = `<strong>${isError ? 'Gagal' : 'Hasil'}:</strong> ${escHtml(text)}`;
    elTimeline.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function setRunning(running, label) {
    elBtnSend.disabled = false;
    if (running) {
      elBtnSend.classList.add('running');
      elSendIcon.textContent = 'stop';
    } else {
      elBtnSend.classList.remove('running');
      elSendIcon.textContent = 'send';
    }
  }

  function loadSharedState() {
    chrome.storage?.local?.get(['active_interaction', 'sessions', 'activeSessionId'], (data) => {
      if (data?.active_interaction?.status === 'pending') {
        widgetManager.renderInteraction(data.active_interaction);
        handleStateChange('WAITING_FOR_USER');
      }
    });
  }

  function bindEvents() {
    elGoalInput.addEventListener('input', () => {
      elBtnSend.disabled = !elGoalInput.value.trim();
    });

    elBtnSend.addEventListener('click', async () => {
      const goal = elGoalInput.value.trim();
      if (!goal) return;

      const userMsg = document.createElement('div');
      userMsg.className = 'chat-user-message';
      userMsg.textContent = goal;
      elTimeline.appendChild(userMsg);
      elGoalInput.value = '';

      handleStateChange('RUNNING');

      // Forward to background / shared agent loop
      chrome.runtime?.sendMessage?.({ action: 'START_TASK', task: goal });
    });

    elBtnMinimize.addEventListener('click', () => {
      elCompactBody.style.display = 'none';
      elCompactFooter.style.display = 'none';
      $('compact-header').style.display = 'none';
      elMinPill.style.display = 'flex';
      window.resizeTo(240, 48);
    });

    elBtnMinExpand.addEventListener('click', () => {
      elMinPill.style.display = 'none';
      $('compact-header').style.display = 'flex';
      elCompactBody.style.display = 'flex';
      elCompactFooter.style.display = 'block';
      window.resizeTo(360, 420);
    });

    elBtnRestore.addEventListener('click', () => {
      window.close();
    });

    elBtnClose.addEventListener('click', () => {
      window.close();
    });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
