"""
Action Controller and tool dispatcher.
"""

import logging
from typing import Any, Callable, Dict
from deep_browser.browser.session import BrowserSession
from deep_browser.models.action import ActionCall
from deep_browser.tools.browser_actions import BrowserActions

logger = logging.getLogger(__name__)


class ToolController:
    """Dispatches action calls to browser implementations."""

    def __init__(self):
        self._registry: Dict[str, Callable] = {
            "navigate": BrowserActions.navigate,
            "click_element": BrowserActions.click_element,
            "type_text": BrowserActions.type_text,
            "scroll": BrowserActions.scroll,
            "browser_execute": BrowserActions.browser_execute,
            "complete_task": BrowserActions.complete_task,
        }

    async def execute(self, session: BrowserSession, action: ActionCall) -> Any:
        """Execute action call against browser session."""
        tool_name = action.tool
        if tool_name not in self._registry:
            raise ValueError(f"Unknown action tool: '{tool_name}'")

        func = self._registry[tool_name]
        logger.info(f"Executing tool '{tool_name}' with params {action.params}")
        return await func(session, **action.params)


tool_controller = ToolController()
