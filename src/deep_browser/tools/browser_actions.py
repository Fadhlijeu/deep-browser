"""
Concrete browser action implementations.
"""

import asyncio
import logging
from typing import Any, Dict
from deep_browser.browser.session import BrowserSession
from deep_browser.config import settings

logger = logging.getLogger(__name__)


class BrowserActions:
    """Tool implementations executed against an active BrowserSession."""

    @staticmethod
    async def navigate(session: BrowserSession, url: str) -> Dict[str, Any]:
        """Navigate active browser page to URL."""
        res = await session.navigate(url)
        return {"status": "success", "url": session.current_url, "title": session.current_title, "cdp": res}

    @staticmethod
    async def click_element(session: BrowserSession, index: int) -> Dict[str, Any]:
        """Click an interactive element by its deep-browser index [1..N]."""
        res = await session.evaluate(
            f"""(() => {{
                const el = document.querySelector('[data-deep-browser-idx="{index}"]');
                if (!el) return {{ success: false, error: "Element not found" }};
                el.scrollIntoView({{ block: 'center', inline: 'center' }});
                el.focus();
                el.click();
                return {{ success: true, tag: el.tagName, text: (el.innerText || '').substring(0, 50) }};
            }})()"""
        )
        await asyncio.sleep(settings.settle_delay_seconds)
        await session.update_page_state()
        return res

    @staticmethod
    async def type_text(session: BrowserSession, index: int, text: str, clear_first: bool = True) -> Dict[str, Any]:
        """Type text into an input or textarea element."""
        res = await session.evaluate(
            f"""(() => {{
                const el = document.querySelector('[data-deep-browser-idx="{index}"]');
                if (!el) return {{ success: false, error: "Element not found" }};
                el.scrollIntoView({{ block: 'center' }});
                el.focus();
                if ({str(clear_first).lower()}) {{
                    el.value = '';
                }}
                el.value = {repr(text)};
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                return {{ success: true, actual_value: el.value }};
            }})()"""
        )
        await asyncio.sleep(settings.settle_delay_seconds)
        return res

    @staticmethod
    async def scroll(session: BrowserSession, direction: str = "down", amount: int = 500) -> Dict[str, Any]:
        """Scroll the window."""
        await session.scroll(direction=direction, amount=amount)
        return {"status": "success", "scrolled": direction, "amount": amount}

    @staticmethod
    async def browser_execute(session: BrowserSession, code: str) -> Dict[str, Any]:
        """BrowserCode pattern: Execute raw JavaScript directly in page context."""
        result = await session.evaluate(code)
        return {"status": "success", "result": result}

    @staticmethod
    async def complete_task(session: BrowserSession, summary: str) -> Dict[str, Any]:
        """Mark task as complete with final deliverable summary."""
        return {"status": "completed", "summary": summary}
