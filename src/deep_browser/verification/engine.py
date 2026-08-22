"""
Deterministic Verification Engine coordinating pre- and post-action assertions.
"""

import logging
from typing import Any, Dict
from deep_browser.browser.session import BrowserSession
from deep_browser.models.action import ActionCall, VerificationResult
from deep_browser.verification.rules import ClickConsequenceRule, NavigationRule, ValueMatchRule

logger = logging.getLogger(__name__)


class VerificationEngine:
    """Verifies that an action was executed and achieved its intended state."""

    def __init__(self):
        self._rules = {
            "type_text": ValueMatchRule(),
            "navigate": NavigationRule(),
            "click_element": ClickConsequenceRule(),
        }

    async def verify_action(
        self,
        session: BrowserSession,
        action: ActionCall,
        pre_state: Dict[str, Any],
    ) -> VerificationResult:
        """Run appropriate verification rule against current browser state."""
        tool = action.tool
        rule = self._rules.get(tool)

        if not rule:
            # Default fallback verification
            return VerificationResult(
                is_verified=True,
                status="VERIFIED",
                assertion=f"Action '{tool}' executed without fatal error",
                actual_state=f"Page is at '{session.current_url}'",
            )

        try:
            return await rule.verify(session, action, pre_state)
        except Exception as e:
            logger.error(f"Verification rule error for {tool}: {e}")
            return VerificationResult(
                is_verified=False,
                status="FAILED",
                assertion=f"Verification execution for '{tool}'",
                actual_state="Exception during verification",
                error_message=str(e),
            )


verification_engine = VerificationEngine()
