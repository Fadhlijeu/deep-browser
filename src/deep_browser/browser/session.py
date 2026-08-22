"""
Browser session lifecycle and tab interaction management.
"""

import asyncio
import base64
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from deep_browser.browser.cdp import CDPClient
from deep_browser.config import settings
from deep_browser.models.action import DOMElement

logger = logging.getLogger(__name__)


class BrowserSession:
    """Represents an active, isolated browser session/tab."""

    def __init__(
        self,
        session_id: str,
        profile_id: str,
        mode: str,
        cdp_ws_url: str,
        target_id: Optional[str] = None,
    ):
        self.session_id = session_id
        self.profile_id = profile_id
        self.mode = mode
        self.cdp_ws_url = cdp_ws_url
        self.target_id = target_id
        self.cdp = CDPClient(cdp_ws_url)
        self.cached_elements: List[DOMElement] = []
        self.current_url: str = ""
        self.current_title: str = ""

    async def initialize(self) -> None:
        """Connect CDP and enable core domains."""
        await self.cdp.connect()
        await self.cdp.send_command("Page.enable")
        await self.cdp.send_command("DOM.enable")
        await self.cdp.send_command("Runtime.enable")
        await self.cdp.send_command("Network.enable")
        await self.update_page_state()

    async def close(self) -> None:
        """Disconnect CDP session."""
        await self.cdp.disconnect()

    async def update_page_state(self) -> Dict[str, str]:
        """Fetch current URL and document title."""
        res = await self.evaluate("({ url: window.location.href, title: document.title })")
        self.current_url = res.get("url", "") if isinstance(res, dict) else ""
        self.current_title = res.get("title", "") if isinstance(res, dict) else ""
        return {"url": self.current_url, "title": self.current_title}

    async def navigate(self, url: str, wait_until_loaded: bool = True) -> Dict[str, Any]:
        """Navigate to target URL."""
        if not url.startswith("http://") and not url.startswith("https://") and not url.startswith("about:"):
            url = f"https://{url}"

        result = await self.cdp.send_command("Page.navigate", {"url": url})
        if wait_until_loaded:
            await asyncio.sleep(settings.settle_delay_seconds * 2)
            await self.update_page_state()
        return result

    async def evaluate(self, expression: str, return_by_value: bool = True) -> Any:
        """Evaluate arbitrary JavaScript within the page execution context."""
        response = await self.cdp.send_command(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": return_by_value,
                "awaitPromise": True,
            },
        )
        result = response.get("result", {})
        if "value" in result:
            return result["value"]
        return result

    async def capture_screenshot(self, save_path: Optional[Path] = None) -> str:
        """Capture screenshot as base64 string and optionally save to disk."""
        response = await self.cdp.send_command(
            "Page.captureScreenshot",
            {"format": "webp", "quality": 80},
        )
        data_base64 = response.get("data", "")
        if save_path and data_base64:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                f.write(base64.b64decode(data_base64))
        return data_base64

    async def scroll(self, direction: str = "down", amount: int = 500) -> None:
        """Scroll the active window."""
        delta = amount if direction == "down" else -amount
        await self.evaluate(f"window.scrollBy({{ top: {delta}, behavior: 'smooth' }});")
        await asyncio.sleep(settings.settle_delay_seconds)
