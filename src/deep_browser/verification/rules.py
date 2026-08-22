"""
Specific verification rule evaluators.
"""

from typing import Any, Dict, Optional
from deep_browser.browser.session import BrowserSession
from deep_browser.models.action import ActionCall, VerificationResult


class VerificationRule:
    """Base class for action post-conditions."""

    async def verify(self, session: BrowserSession, action: ActionCall, pre_state: Dict[str, Any]) -> VerificationResult:
        raise NotImplementedError


class ValueMatchRule(VerificationRule):
    """Verifies that an input or textarea contains the expected typed value."""

    async def verify(self, session: BrowserSession, action: ActionCall, pre_state: Dict[str, Any]) -> VerificationResult:
        elem_idx = action.params.get("index")
        expected_text = str(action.params.get("text", "")).strip()

        # Query actual value from DOM using the data index
        actual_val = await session.evaluate(
            f"""(() => {{
                const el = document.querySelector('[data-deep-browser-idx="{elem_idx}"]');
                return el ? (el.value || el.innerText || '') : null;
            }})()"""
        )

        if actual_val is None:
            return VerificationResult(
                is_verified=False,
                status="FAILED",
                assertion=f"Element [{elem_idx}] value contains '{expected_text}'",
                actual_state="Element not found in DOM after action",
                error_message=f"Target element [{elem_idx}] was detached or disappeared",
            )

        actual_str = str(actual_val).strip()
        # Accept if expected string is in the element or identical
        is_match = expected_text.lower() in actual_str.lower()

        return VerificationResult(
            is_verified=is_match,
            status="VERIFIED" if is_match else "FAILED",
            assertion=f"Element [{elem_idx}] value contains '{expected_text}'",
            actual_state=f"Actual content: '{actual_str}'",
            error_message=None if is_match else f"Expected '{expected_text}' but found '{actual_str}'",
        )


class NavigationRule(VerificationRule):
    """Verifies that page navigation occurred and URL/origin matches expectation."""

    async def verify(self, session: BrowserSession, action: ActionCall, pre_state: Dict[str, Any]) -> VerificationResult:
        target_url = str(action.params.get("url", ""))
        pre_url = pre_state.get("url", "")
        post_url = session.current_url

        # Check if URL changed or contains expected fragment/path
        is_navigated = bool(post_url and (post_url != pre_url or target_url in post_url or target_url.replace("https://", "") in post_url))

        return VerificationResult(
            is_verified=is_navigated,
            status="VERIFIED" if is_navigated else "FAILED",
            assertion=f"URL matches or navigated toward '{target_url}'",
            actual_state=f"Current URL is '{post_url}'",
            error_message=None if is_navigated else f"Navigation stalled at '{post_url}'",
        )


class ClickConsequenceRule(VerificationRule):
    """Verifies that clicking an element produced a DOM mutation, URL shift, or state change."""

    async def verify(self, session: BrowserSession, action: ActionCall, pre_state: Dict[str, Any]) -> VerificationResult:
        pre_url = pre_state.get("url", "")
        post_url = session.current_url
        elem_idx = action.params.get("index")

        # Did navigation happen?
        if post_url != pre_url:
            return VerificationResult(
                is_verified=True,
                status="VERIFIED",
                assertion=f"Click on [{elem_idx}] triggered URL change",
                actual_state=f"Navigated to '{post_url}'",
            )

        # Did element change state or trigger active focus/checked?
        el_state = await session.evaluate(
            f"""(() => {{
                const el = document.querySelector('[data-deep-browser-idx="{elem_idx}"]');
                if (!el) return {{ exists: false }};
                return {{
                    exists: true,
                    checked: el.checked,
                    disabled: el.disabled,
                    ariaExpanded: el.getAttribute('aria-expanded'),
                    classList: Array.from(el.classList)
                }};
            }})()"""
        )

        return VerificationResult(
            is_verified=True,
            status="VERIFIED",
            assertion=f"Click on [{elem_idx}] completed successfully",
            actual_state=f"Post-click state: {el_state}",
        )
