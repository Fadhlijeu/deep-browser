// Deep-Browser Content HUD Overlay

(() => {
    let activeHighlight = null;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'HIGHLIGHT') {
            highlightElementByIndex(message.index);
        } else if (message.type === 'CLEAR_HIGHLIGHT') {
            clearHighlight();
        }
    });

    function highlightElementByIndex(index) {
        clearHighlight();

        const el = document.querySelector(`[data-deep-browser-idx="${index}"]`);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        activeHighlight = document.createElement('div');
        activeHighlight.className = 'deep-browser-hud-box';
        activeHighlight.style.top = `${window.scrollY + rect.top}px`;
        activeHighlight.style.left = `${window.scrollX + rect.left}px`;
        activeHighlight.style.width = `${rect.width}px`;
        activeHighlight.style.height = `${rect.height}px`;

        const badge = document.createElement('div');
        badge.className = 'deep-browser-hud-badge';
        badge.textContent = `Deep-Browser [${index}]`;
        activeHighlight.appendChild(badge);

        document.body.appendChild(activeHighlight);

        // Auto remove highlight after 3 seconds
        setTimeout(clearHighlight, 3000);
    }

    function clearHighlight() {
        if (activeHighlight && activeHighlight.parentElement) {
            activeHighlight.parentElement.removeChild(activeHighlight);
            activeHighlight = null;
        }
    }
})();
