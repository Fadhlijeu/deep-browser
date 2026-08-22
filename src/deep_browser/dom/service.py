"""
DOM Service: In-browser interactive element extraction, indexing, and accessibility modeling.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List
from deep_browser.browser.session import BrowserSession
from deep_browser.dom.views import DOMSnapshot
from deep_browser.models.action import DOMElement

logger = logging.getLogger(__name__)

DOM_EXTRACTION_SCRIPT = """
(() => {
    const isVisible = (elem) => {
        if (!elem) return false;
        const style = window.getComputedStyle(elem);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = elem.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    const isInteractive = (elem) => {
        const tag = elem.tagName.toLowerCase();
        if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return true;
        if (elem.hasAttribute('onclick') || elem.getAttribute('role') === 'button' || elem.getAttribute('role') === 'link') return true;
        if (elem.getAttribute('tabindex') === '0' || elem.getAttribute('contenteditable') === 'true') return true;
        return false;
    };

    const getCleanText = (elem) => {
        const tag = elem.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
            if (elem.type === 'password') return '[REDACTED_PASSWORD]';
            return elem.value || elem.placeholder || '';
        }
        if (tag === 'select') {
            return elem.options[elem.selectedIndex]?.text || '';
        }
        return (elem.innerText || elem.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 150);
    };

    const getSelector = (elem) => {
        if (elem.id) return `#${elem.id}`;
        let path = [];
        let current = elem;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.className && typeof current.className === 'string' && current.className.trim()) {
                const firstClass = current.className.trim().split(/\\s+/)[0];
                if (firstClass && !firstClass.includes(':')) selector += `.${firstClass}`;
            }
            path.unshift(selector);
            current = current.parentElement;
            if (path.length >= 3) break;
        }
        return path.join(' > ');
    };

    const allElements = document.querySelectorAll('*');
    const interactiveList = [];
    let indexCounter = 1;

    for (const el of allElements) {
        if (isInteractive(el) && isVisible(el)) {
            const rect = el.getBoundingClientRect();
            const tag = el.tagName.toLowerCase();
            const text = getCleanText(el);
            const selector = getSelector(el);
            const role = el.getAttribute('role') || el.type || tag;
            
            // Collect attributes
            const attrs = {};
            for (const attr of ['name', 'type', 'placeholder', 'href', 'value', 'aria-label', 'title']) {
                if (el.hasAttribute(attr)) {
                    attrs[attr] = el.getAttribute(attr);
                }
            }

            // Tag DOM element with deep-browser-idx attribute for instant targeting
            el.setAttribute('data-deep-browser-idx', indexCounter.toString());

            interactiveList.push({
                index: indexCounter,
                tag: tag,
                text: text,
                role: role,
                selector: selector,
                bounding_box: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                attributes: attrs,
                is_interactive: true,
                is_visible: true
            });
            indexCounter++;
            if (indexCounter > 250) break; // Limit elements per page
        }
    }

    return {
        url: window.location.href,
        title: document.title,
        interactive_elements: interactiveList,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scroll_position: { x: window.scrollX, y: window.scrollY }
    };
})()
"""


class DOMService:
    """Extracts, indexes, and formats the interactive DOM state for agent reasoning."""

    @staticmethod
    async def extract_dom_snapshot(session: BrowserSession) -> DOMSnapshot:
        """Execute DOM script and return structured DOM snapshot."""
        raw = await session.evaluate(DOM_EXTRACTION_SCRIPT)
        if not isinstance(raw, dict):
            raw = {
                "url": session.current_url,
                "title": session.current_title,
                "interactive_elements": [],
                "viewport": {"width": 1280, "height": 800},
                "scroll_position": {"x": 0, "y": 0},
            }

        elements: List[DOMElement] = []
        tree_lines = []

        for item in raw.get("interactive_elements", []):
            elem = DOMElement(**item)
            elements.append(elem)

            # Build human-readable concise tree line
            desc_parts = [f"[{elem.index}] <{elem.tag}>"]
            if elem.role and elem.role != elem.tag:
                desc_parts.append(f'role="{elem.role}"')
            if elem.text:
                desc_parts.append(f'"{elem.text}"')
            if "placeholder" in elem.attributes:
                desc_parts.append(f'placeholder="{elem.attributes["placeholder"]}"')
            if "href" in elem.attributes:
                desc_parts.append(f'href="{elem.attributes["href"]}"')

            tree_lines.append(" ".join(desc_parts))

        session.cached_elements = elements
        session.current_url = raw.get("url", "")
        session.current_title = raw.get("title", "")

        return DOMSnapshot(
            url=session.current_url,
            title=session.current_title,
            interactive_elements=raw.get("interactive_elements", []),
            element_tree_text="\n".join(tree_lines),
            viewport=raw.get("viewport", {}),
            scroll_position=raw.get("scroll_position", {}),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
