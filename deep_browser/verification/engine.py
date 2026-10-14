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

    async def capture_state(self, target_obj: Any) -> Dict[str, Any]:
        """Captures a lightweight deterministic snapshot of current browser or agent state."""
        url = ""
        ready_state = "unknown"
        dom_summary = ""

        try:
            # Check if target_obj is Agent with history
            if hasattr(target_obj, "history") and hasattr(target_obj.history, "urls"):
                urls = target_obj.history.urls()
                if urls:
                    url = urls[-1]
                    ready_state = "complete"

            # Check if target_obj is Agent with browser_session
            session = getattr(target_obj, "browser_session", target_obj)

            # Check BrowserSession session_manager targets
            title = ""
            # Check BrowserSession session_manager targets
            if not url and hasattr(session, "session_manager"):
                targets = session.session_manager.get_all_page_targets()
                for target in targets:
                    if target.url and target.url != "about:blank":
                        url = target.url
                        title = getattr(target, "title", "")
                        ready_state = "complete"
                        break
                if not url and hasattr(session, "agent_focus_target_id") and session.agent_focus_target_id:
                    focus_target = session.session_manager.get_target(session.agent_focus_target_id)
                    if focus_target and focus_target.url:
                        url = focus_target.url
                        title = getattr(focus_target, "title", "")
                        ready_state = "complete"

            # Direct url attribute fallback
            if not url and hasattr(session, "url") and session.url:
                url = session.url
                ready_state = "complete"

            if hasattr(target_obj, "last_result") and target_obj.last_result:
                dom_summary = str(getattr(target_obj.last_result, "extracted_content", "") or "")

            dom_hash = hashlib.md5(f"{url}_{ready_state}_{title}_{dom_summary}".encode()).hexdigest()

            return {
                "url": url,
                "title": title,
                "ready_state": ready_state,
                "dom_hash": dom_hash,
                "dom_summary": dom_summary,
            }
        except Exception as e:
            logger.debug(f"State capture non-critical error: {e}")
            return {"url": "", "title": "", "ready_state": "unknown", "dom_hash": ""}

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

        # Fallback heuristic for generic actions: require actual observable mutation
        state_changed = (
            before_state.get("url") != after_state.get("url")
            or before_state.get("dom_hash") != after_state.get("dom_hash")
            or before_state.get("ready_state") != after_state.get("ready_state")
        )
        evidence = Evidence(
            action_type=action_name,
            before_state=before_state,
            after_state=after_state,
            mutations_observed=["Observable state transition detected"] if state_changed else [],
        )

        return VerificationResult(
            verified=state_changed,
            stage=ActionStage.VERIFIED if state_changed else ActionStage.OUTCOME_UNKNOWN,
            evidence=evidence,
            details=(
                f"Generic action '{action_name}' verified with observable state change"
                if state_changed
                else f"Action '{action_name}' executed but observable outcome is unknown"
            ),
        )
