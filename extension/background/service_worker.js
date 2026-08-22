// Deep-Browser Chrome Extension Service Worker
// Maintains WebSocket event stream to companion server.
// Extension tasks run via browser attached mode (same browser, port 9222).

const COMPANION_WS = 'ws://127.0.0.1:8765/ws/extension';
let socket = null;

// --- SidePanel Setup ---
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error('[Deep-Browser] SidePanel setup error:', e));

// --- WebSocket Connection to Companion Server ---
function connectWebSocket() {
    try { if (socket) socket.close(); } catch (e) {}

    socket = new WebSocket(COMPANION_WS);

    socket.onopen = () => {
        console.log('[Deep-Browser] Connected to companion server');
        chrome.runtime.sendMessage({ type: 'WS_STATUS', status: 'connected' }).catch(() => {});
    };

    socket.onclose = () => {
        console.log('[Deep-Browser] Disconnected. Retrying in 3s...');
        chrome.runtime.sendMessage({ type: 'WS_STATUS', status: 'disconnected' }).catch(() => {});
        setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = () => {
        chrome.runtime.sendMessage({ type: 'WS_STATUS', status: 'disconnected' }).catch(() => {});
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Forward agent events to sidepanel
            chrome.runtime.sendMessage({ type: 'AGENT_EVENT', payload: data }).catch(() => {});

            // HUD highlight on element click events
            if (data.event_type === 'CLICK' && data.data?.index != null) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id,
                            { type: 'HIGHLIGHT', index: data.data.index }
                        ).catch(() => {});
                    }
                });
            }
        } catch (err) {
            console.error('[Deep-Browser] WS message error:', err);
        }
    };
}

connectWebSocket();

// --- Message Handler from SidePanel ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type } = message;

    if (type === 'GET_WS_STATUS') {
        sendResponse({ isConnected: socket?.readyState === WebSocket.OPEN });
    }

    if (type === 'GET_ACTIVE_TAB') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse(tabs?.[0] || null);
        });
        return true; // async
    }
});
