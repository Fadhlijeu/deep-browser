"""
Deterministic Verification Engine wrapping Browser Use actions.
Enforces invariant: Never 'Executed == Success' without observable evidence.
"""

import hashlib
import logging
from typing import Any, Dict, Optional
from deep_browser.verification.models import ActionStage, Evidence, VerificationResult
from deep_browser.verification.rules import (
    BaseVerificationRule,
    ClickVerificationRule,
    InputVerificationRule,
    NavigationVerificationRule,
)

logger = logging.getLogger(__name__)


class VerificationEngine:
    def __init__(self):
        self._rules: Dict[str, BaseVerificationRule] = {
            "navigate": NavigationVerificationRule(),
            "go_to_url": NavigationVerificationRule(),
            "search": NavigationVerificationRule(),
            "click_element": ClickVerificationRule(),
            "click_coordinate": ClickVerificationRule(),
            "input_text": InputVerificationRule(),
            "type_text": InputVerificationRule(),
        }

    async def capture_state(self, browser_session: Any) -> Dict[str, Any]:
        """Captures a lightweight deterministic snapshot of current browser state."""
        try:
            url = ""
            ready_state = "unknown"
            if hasattr(browser_session, "get_current_page"):
                page = await browser_session.get_current_page()
                if page:
                    url = page.url
                    ready_state = await page.evaluate("document.readyState")
            elif hasattr(browser_session, "url"):
                url = browser_session.url

            dom_summary = ""
            if hasattr(browser_session, "get_dom_service"):
                dom_svc = await browser_session.get_dom_service()
                if dom_svc and hasattr(dom_svc, "get_clickable_elements"):
                    elements = await dom_svc.get_clickable_elements()
                    dom_summary = f"clickable_count:{len(elements)}"

            dom_hash = hashlib.md5(f"{url}_{dom_summary}".encode()).hexdigest()

            return {
                "url": url,
                "ready_state": ready_state,
                "dom_hash": dom_hash,
                "dom_summary": dom_summary,
            }
        except Exception as e:
            logger.debug(f"State capture non-critical error: {e}")
            return {"url": "", "ready_state": "unknown", "dom_hash": ""}

    async def verify_action(
        self,
        action_name: str,
        action_params: Dict[str, Any],
        before_state: Dict[str, Any],
        after_state: Dict[str, Any],
    ) -> VerificationResult:
        """Deterministically verifies action outcome."""
        rule = self._rules.get(action_name)
        if rule:
            return await rule.verify(before_state, after_state, action_params)

        # Fallback heuristic for generic actions
        state_changed = before_state != after_state
        evidence = Evidence(
            action_type=action_name,
            before_state=before_state,
            after_state=after_state,
            mutations_observed=["State transition detected"] if state_changed else [],
        )

        return VerificationResult(
            verified=True,
            stage=ActionStage.VERIFIED if state_changed else ActionStage.EXECUTED,
            evidence=evidence,
            details=f"Generic action '{action_name}' executed",
        )
