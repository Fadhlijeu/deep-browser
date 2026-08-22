"""
Safe Mode Policy and Human Confirmation Gateways for Deep-Browser.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ConfirmationRequest(BaseModel):
    action_name: str
    target_description: str
    risk_level: str  # "high", "medium", "low"
    reason: str
    parameters: Dict[str, Any]


class SafeModePolicy:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.sensitive_action_keywords = [
            "delete",
            "remove",
            "drop",
            "cancel_subscription",
            "buy",
            "purchase",
            "pay",
            "checkout",
            "submit_order",
            "send_message",
            "publish",
            "transfer",
        ]
        self.sensitive_element_patterns = [
            "delete",
            "remove",
            "trash",
            "purchase",
            "pay now",
            "confirm payment",
            "submit application",
            "send transfer",
        ]

    def requires_confirmation(self, action_name: str, params: Dict[str, Any], element_text: Optional[str] = None) -> Optional[ConfirmationRequest]:
        if not self.enabled:
            return None

        # Check action name keywords
        for keyword in self.sensitive_action_keywords:
            if keyword in action_name.lower():
                return ConfirmationRequest(
                    action_name=action_name,
                    target_description=f"Action '{action_name}' is classified as sensitive",
                    risk_level="high",
                    reason=f"Action contains critical keyword: '{keyword}'",
                    parameters=params,
                )

        # Check target element text if clicking or typing
        if element_text:
            text_lower = element_text.lower()
            for pattern in self.sensitive_element_patterns:
                if pattern in text_lower:
                    return ConfirmationRequest(
                        action_name=action_name,
                        target_description=f"Target element text: '{element_text}'",
                        risk_level="high",
                        reason=f"Element text contains critical keyword: '{pattern}'",
                        parameters=params,
                    )

        return None
