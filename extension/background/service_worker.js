// Deep-Browser Chrome Extension Service Worker

let socket = null;
const WS_URL = 'ws://127.0.0.1:8765/ws/extension';

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log('[Deep-Browser Extension] Connected to Companion Server');
        chrome.runtime.sendMessage({ type: 'WS_STATUS', status: 'connected' }).catch(() => {});
    };

    socket.onclose = () => {
        console.log('[Deep-Browser Extension] Disconnected from Companion Server, retrying in 3s');
        chrome.runtime.sendMessage({ type: 'WS_STATUS', status: 'disconnected' }).catch(() => {});
        setTimeout(connectWebSocket, 3000);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Forward event to sidepanel or active tab HUD
            chrome.runtime.sendMessage({ type: 'AGENT_EVENT', payload: data }).catch(() => {});

            if (data.event === 'HIGHLIGHT_ELEMENT') {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'HIGHLIGHT', index: data.data.index });
                    }
                });
            }
        } catch (err) {
            console.error('Error in WS message dispatch:', err);
        }
    };
}

// Enable SidePanel on action click
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Initialize connection
connectWebSocket();

// Handle messages from SidePanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_WS_STATUS') {
        sendResponse({ isConnected: socket && socket.readyState === WebSocket.OPEN });
    }
});
