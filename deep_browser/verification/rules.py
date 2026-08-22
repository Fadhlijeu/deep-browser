"""
Deterministic verification rules for Deep-Browser actions.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict
from deep_browser.verification.models import VerificationResult, ActionStage, Evidence


class BaseVerificationRule(ABC):
    @abstractmethod
    async def verify(self, before: Dict[str, Any], after: Dict[str, Any], action_params: Dict[str, Any]) -> VerificationResult:
        """Verifies if the action achieved its intended state change."""
        pass


class NavigationVerificationRule(BaseVerificationRule):
    async def verify(self, before: Dict[str, Any], after: Dict[str, Any], action_params: Dict[str, Any]) -> VerificationResult:
        old_url = before.get("url", "")
        new_url = after.get("url", "")
        target_url = action_params.get("url", "")

        mutations = []
        if old_url != new_url:
            mutations.append(f"URL changed from '{old_url}' to '{new_url}'")

        if after.get("ready_state") == "complete":
            mutations.append("Document readyState reached 'complete'")

        verified = (new_url != old_url or (target_url and target_url in new_url)) and after.get("ready_state") in ("complete", "interactive")
        
        evidence = Evidence(
            action_type="navigate",
            before_state=before,
            after_state=after,
            mutations_observed=mutations
        )

        return VerificationResult(
            verified=verified,
            stage=ActionStage.VERIFIED if verified else ActionStage.FAILED,
            evidence=evidence,
            details=f"Navigation to '{new_url}' verified" if verified else f"Failed to verify navigation to '{target_url}'"
        )


class ClickVerificationRule(BaseVerificationRule):
    async def verify(self, before: Dict[str, Any], after: Dict[str, Any], action_params: Dict[str, Any]) -> VerificationResult:
        old_url = before.get("url", "")
        new_url = after.get("url", "")
        old_dom_hash = before.get("dom_hash", "")
        new_dom_hash = after.get("dom_hash", "")
        old_active = before.get("active_element", "")
        new_active = after.get("active_element", "")

        mutations = []
        if old_url != new_url:
            mutations.append(f"URL changed to {new_url}")
        if old_dom_hash != new_dom_hash:
            mutations.append("DOM tree structure or text mutated")
        if old_active != new_active:
            mutations.append(f"Active focus changed to {new_active}")

        verified = len(mutations) > 0 or after.get("element_clicked", False)

        evidence = Evidence(
            action_type="click",
            target_index=action_params.get("index"),
            target_selector=action_params.get("selector"),
            before_state=before,
            after_state=after,
            mutations_observed=mutations
        )

        return VerificationResult(
            verified=verified,
            stage=ActionStage.VERIFIED if verified else ActionStage.FAILED,
            evidence=evidence,
            details="Click produced verified DOM or focus mutation" if verified else "Click triggered no observable mutation"
        )


class InputVerificationRule(BaseVerificationRule):
    async def verify(self, before: Dict[str, Any], after: Dict[str, Any], action_params: Dict[str, Any]) -> VerificationResult:
        expected_text = action_params.get("text", "")
        field_value = after.get("field_value", "")
        old_value = before.get("field_value", "")

        mutations = []
        if old_value != field_value:
            mutations.append(f"Field value changed from '{old_value}' to '{field_value}'")

        verified = expected_text in field_value or len(field_value) > len(old_value)

        evidence = Evidence(
            action_type="input_text",
            target_index=action_params.get("index"),
            target_selector=action_params.get("selector"),
            before_state=before,
            after_state=after,
            mutations_observed=mutations
        )

        return VerificationResult(
            verified=verified,
            stage=ActionStage.VERIFIED if verified else ActionStage.FAILED,
            evidence=evidence,
            details=f"Input text verification succeeded (value: '{field_value}')" if verified else "Input field value did not update as expected"
        )
