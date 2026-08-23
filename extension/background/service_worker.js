// Deep-Browser Chrome Extension Service Worker
// Standalone Extension Mode — Zero WebSocket / Server dependency.

// --- SidePanel Setup ---
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error('[Deep-Browser] SidePanel setup error:', e));

// --- Runtime Lifecycle ---
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Deep-Browser] Extension installed and ready.');
});

// --- Message Routing ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, action } = message;

  if (type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse(tabs?.[0] || null);
    });
    return true; // async response
  }

  // Relay actions from In-Page Floating HUD to SidePanel / active listeners
  if (action === 'START_TASK_FROM_HUD' || action === 'RESOLVE_INTERACTION_FROM_HUD') {
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
});

