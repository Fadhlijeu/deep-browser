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
  const { type } = message;

  if (type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse(tabs?.[0] || null);
    });
    return true; // async response
  }
});
