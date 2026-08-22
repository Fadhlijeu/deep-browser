"""
Safe Mode Policy, Manager, and SafeTools for Deep-Browser.
Wraps Browser Use Tools with deterministic pause-and-confirm gateways for sensitive actions.
"""

import asyncio
from enum import Enum
import time
from typing import Any, Dict, Optional, Tuple
from pydantic import BaseModel, Field

from browser_use.browser.session import BrowserSession
from browser_use.tools.service import Tools
from browser_use.agent.views import ActionResult
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType


class SafeModeState(str, Enum):
    RUNNING = "RUNNING"
    PAUSED_FOR_CONFIRMATION = "PAUSED_FOR_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    RESUMING = "RESUMING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"


class SensitiveCategory(str, Enum):
    SUBMIT = "SUBMIT"
    SEND = "SEND"
    DELETE = "DELETE"
    PURCHASE = "PURCHASE"
    PUBLISH = "PUBLISH"
    ACCOUNT_CHANGE = "ACCOUNT_CHANGE"


class ConfirmationRequest(BaseModel):
    confirmation_id: str = Field(default_factory=lambda: f"conf_{int(time.time() * 1000)}")
    task_id: str = "task_default"
    session_id: Optional[str] = None
    category: SensitiveCategory = SensitiveCategory.SUBMIT
    action: str
    target: str
    reason: str
    risk_level: str = "high"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    expires_at: float = 0.0
    timeout_seconds: float = 60.0


class SafeModeManager:
    """Singleton manager tracking pending user confirmations."""
    _instance: Optional["SafeModeManager"] = None

    def __init__(self):
        self._pending: Dict[str, Tuple[asyncio.Future, ConfirmationRequest]] = {}
        self._history: Dict[str, str] = {}  # confirmation_id -> decision

    @classmethod
    def get_instance(cls) -> "SafeModeManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, req: ConfirmationRequest) -> asyncio.Future:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop_policy().get_event_loop()
            except Exception:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        fut: asyncio.Future[str] = loop.create_future()
        self._pending[req.confirmation_id] = (fut, req)
        return fut

    def resolve_confirmation(self, confirmation_id: str, decision: str) -> bool:
        """
        Resolves a pending confirmation.
        Returns True if resolved, False if duplicate/expired/unknown.
        """
        normalized_decision = decision.upper().strip()
        if confirmation_id in self._history:
            # Duplicate confirmation response -> safely ignored
            return False

        if confirmation_id not in self._pending:
            return False

        fut, req = self._pending.pop(confirmation_id)
        self._history[confirmation_id] = normalized_decision

        if not fut.done():
            fut.set_result(normalized_decision)
            return True
        return False

    def clear(self):
        for fut, _ in self._pending.values():
            if not fut.done():
                fut.cancel()
        self._pending.clear()
        self._history.clear()


class SafeModePolicy:
    """Deterministic policy detecting sensitive browser actions."""

    def __init__(self, enabled: bool = True, timeout_seconds: float = 60.0):
        self.enabled = enabled
        self.timeout_seconds = timeout_seconds

        self.category_keywords = {
            SensitiveCategory.DELETE: [
                "delete", "remove", "hapus", "destroy", "drop", "uninstall",
                "trash", "cancel account", "terminate", "purge", "wipe",
            ],
            SensitiveCategory.PURCHASE: [
                "buy", "purchase", "pay", "bayar", "subscribe", "order now",
                "beli", "checkout", "charge", "confirm payment", "place order",
            ],
            SensitiveCategory.SUBMIT: [
                "submit", "kirim", "konfirmasi", "confirm", "submit form",
                "submit application", "finish registration", "daftar sekarang",
            ],
            SensitiveCategory.SEND: [
                "send", "kirim pesan", "send message", "send email", "post comment",
                "dispatch", "forward",
            ],
            SensitiveCategory.PUBLISH: [
                "publish", "terbitkan", "deploy", "release", "post live",
                "broadcast", "publish article",
            ],
            SensitiveCategory.ACCOUNT_CHANGE: [
                "change password", "update password", "ubah kata sandi",
                "reset password", "transfer balance", "transfer dana",
                "update payment method",
            ],
        }

    def check_action_safety(
        self,
        action_name: str,
        params: Dict[str, Any],
        element_text: Optional[str] = None,
        element_tag: Optional[str] = None,
        element_type: Optional[str] = None,
        task_id: str = "task_default",
        session_id: Optional[str] = None,
    ) -> Optional[ConfirmationRequest]:
        if not self.enabled:
            return None

        action_lower = action_name.lower()
        text_lower = (element_text or "").lower()
        tag_lower = (element_tag or "").lower()
        type_lower = (element_type or "").lower()

        # Check for submit buttons directly
        if type_lower == "submit" or (tag_lower == "button" and "submit" in text_lower):
            expires_at = time.time() + self.timeout_seconds
            return ConfirmationRequest(
                task_id=task_id,
                session_id=session_id,
                category=SensitiveCategory.SUBMIT,
                action="Submit form",
                target=element_text or "Submit button",
                reason="Form submission detected",
                parameters=params,
                expires_at=expires_at,
                timeout_seconds=self.timeout_seconds,
            )

        # Check all sensitive categories across action name, text, and parameters
        for category, keywords in self.category_keywords.items():
            for kw in keywords:
                # 1. Matches in action name
                if kw in action_lower:
                    expires_at = time.time() + self.timeout_seconds
                    return ConfirmationRequest(
                        task_id=task_id,
                        session_id=session_id,
                        category=category,
                        action=f"{category.value} action: {action_name}",
                        target=element_text or action_name,
                        reason=f"Action contains critical keyword: '{kw}'",
                        parameters=params,
                        expires_at=expires_at,
                        timeout_seconds=self.timeout_seconds,
                    )

                # 2. Matches in element text/label
                if element_text and kw in text_lower:
                    expires_at = time.time() + self.timeout_seconds
                    return ConfirmationRequest(
                        task_id=task_id,
                        session_id=session_id,
                        category=category,
                        action=f"{category.value} button/element",
                        target=element_text,
                        reason=f"Target element contains critical keyword: '{kw}'",
                        parameters=params,
                        expires_at=expires_at,
                        timeout_seconds=self.timeout_seconds,
                    )

                # 3. Matches in action parameter text (e.g. typing "delete my account")
                for p_val in params.values():
                    if isinstance(p_val, str) and kw in p_val.lower() and len(kw) > 3:
                        expires_at = time.time() + self.timeout_seconds
                        return ConfirmationRequest(
                            task_id=task_id,
                            session_id=session_id,
                            category=category,
                            action=f"{category.value} parameter input",
                            target=str(p_val),
                            reason=f"Parameter contains critical keyword: '{kw}'",
                            parameters=params,
                            expires_at=expires_at,
                            timeout_seconds=self.timeout_seconds,
                        )

        return None

    # Backward compatibility
    def requires_confirmation(self, action_name: str, params: Dict[str, Any], element_text: Optional[str] = None) -> Optional[ConfirmationRequest]:
        return self.check_action_safety(action_name=action_name, params=params, element_text=element_text)


class SafeTools(Tools):
    """
    Extends Browser Use Tools with Safe Mode confirmation gating.
    Never executes a second action engine — delegates to super().act() on approval.
    """

    def __init__(self, safe_policy: Optional[SafeModePolicy] = None, broadcaster: Optional[EventBroadcaster] = None, **kwargs):
        super().__init__(**kwargs)
        self.safe_policy = safe_policy or SafeModePolicy()
        self.broadcaster = broadcaster or EventBroadcaster.get_instance()
        self.manager = SafeModeManager.get_instance()

    async def act(
        self,
        action: ActionModel,
        browser_session: BrowserSession,
        task_id: str = "task_default",
        **kwargs,
    ) -> ActionResult:
        if not self.safe_policy.enabled:
            return await super().act(action=action, browser_session=browser_session, **kwargs)

        # Inspect proposed actions for safety
        for action_name, params in action.model_dump(exclude_unset=True).items():
            if params is None:
                continue

            element_text = None
            element_tag = None
            element_type = None

            # Extract node info if available
            target_idx = params.get("index") if isinstance(params, dict) else None
            if target_idx is not None:
                try:
                    node = await browser_session.get_element_by_index(target_idx)
                    if node is None:
                        from browser_use.dom.service import DomService
                        dom_service = DomService(browser_session=browser_session)
                        serialized_dom, _, _ = await dom_service.get_serialized_dom_tree()
                        node = serialized_dom.selector_map.get(target_idx)

                    if node:
                        element_tag = getattr(node, "tag_name", None) or getattr(node, "node_name", None)
                        attrs = getattr(node, "attributes", {}) or {}
                        element_type = attrs.get("type")

                        texts = []
                        if getattr(node, "node_value", None):
                            texts.append(node.node_value)
                        if getattr(node, "ax_node", None) and getattr(node.ax_node, "name", None):
                            texts.append(node.ax_node.name)
                        for k in ("value", "aria-label", "title", "placeholder", "id", "name"):
                            if attrs.get(k):
                                texts.append(attrs[k])
                        if getattr(node, "children_nodes", None):
                            for child in node.children_nodes:
                                if getattr(child, "node_value", None):
                                    texts.append(child.node_value)
                                if getattr(child, "ax_node", None) and getattr(child.ax_node, "name", None):
                                    texts.append(child.ax_node.name)
                        element_text = " ".join(texts)
                except Exception:
                    pass

            confirmation_req = self.safe_policy.check_action_safety(
                action_name=action_name,
                params=params if isinstance(params, dict) else {},
                element_text=element_text,
                element_tag=element_tag,
                element_type=element_type,
                task_id=task_id,
                session_id=getattr(browser_session, "id", None),
            )

            if confirmation_req is not None:
                # Sensitive action detected -> PAUSE and emit CONFIRMATION_REQUIRED
                fut = self.manager.register(confirmation_req)

                event_data = {
                    "type": "CONFIRMATION_REQUIRED",
                    "confirmation_id": confirmation_req.confirmation_id,
                    "task_id": confirmation_req.task_id,
                    "session_id": confirmation_req.session_id,
                    "category": confirmation_req.category.value,
                    "action": confirmation_req.action,
                    "target": confirmation_req.target,
                    "reason": confirmation_req.reason,
                    "expires_at": confirmation_req.expires_at,
                    "timeout_seconds": confirmation_req.timeout_seconds,
                    "parameters": confirmation_req.parameters,
                }

                await self.broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=confirmation_req.task_id,
                        session_id=confirmation_req.session_id,
                        event_type=EventType.CONFIRMATION_REQUIRED,
                        message=f"Safe Mode: Sensitive action detected ({confirmation_req.action} on '{confirmation_req.target}'). Waiting for user confirmation...",
                        data=event_data,
                    )
                )

                await self.broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=confirmation_req.task_id,
                        session_id=confirmation_req.session_id,
                        event_type=EventType.PAUSED_FOR_CONFIRMATION,
                        message="Task execution paused pending user decision.",
                        data={"confirmation_id": confirmation_req.confirmation_id},
                    )
                )

                # Wait for user decision or timeout
                try:
                    decision = await asyncio.wait_for(fut, timeout=confirmation_req.timeout_seconds)
                except asyncio.TimeoutError:
                    # Timeout -> CANCEL, never silently approve
                    await self.broadcaster.broadcast(
                        DeepBrowserEvent(
                            task_id=confirmation_req.task_id,
                            session_id=confirmation_req.session_id,
                            event_type=EventType.ACTION_TIMED_OUT,
                            message=f"Safe Mode: Confirmation timed out after {confirmation_req.timeout_seconds}s. Action cancelled.",
                            data={"confirmation_id": confirmation_req.confirmation_id},
                        )
                    )
                    return ActionResult(
                        error=f"Action cancelled: Safe Mode confirmation timed out after {confirmation_req.timeout_seconds}s with no user response."
                    )
                except asyncio.CancelledError:
                    return ActionResult(error="Action cancelled: Confirmation interrupted.")

                if decision == "CONFIRM":
                    await self.broadcaster.broadcast(
                        DeepBrowserEvent(
                            task_id=confirmation_req.task_id,
                            session_id=confirmation_req.session_id,
                            event_type=EventType.ACTION_CONFIRMED,
                            message="Safe Mode: Action confirmed by user. Resuming execution...",
                            data={"confirmation_id": confirmation_req.confirmation_id},
                        )
                    )
                    await self.broadcaster.broadcast(
                        DeepBrowserEvent(
                            task_id=confirmation_req.task_id,
                            session_id=confirmation_req.session_id,
                            event_type=EventType.RESUMING,
                            message="Resuming pending Browser Use action execution.",
                            data={"confirmation_id": confirmation_req.confirmation_id},
                        )
                    )
                    # Execute exact pending action EXACTLY ONCE via super().act()
                    return await super().act(action=action, browser_session=browser_session, **kwargs)

                else:  # REJECT
                    await self.broadcaster.broadcast(
                        DeepBrowserEvent(
                            task_id=confirmation_req.task_id,
                            session_id=confirmation_req.session_id,
                            event_type=EventType.ACTION_REJECTED,
                            message=f"Safe Mode: Action rejected by user. Action cancelled.",
                            data={"confirmation_id": confirmation_req.confirmation_id},
                        )
                    )
                    return ActionResult(
                        error="Action cancelled by user: Confirmation was explicitly rejected in Safe Mode."
                    )

        # Safe action -> execute normally via super().act()
        return await super().act(action=action, browser_session=browser_session, **kwargs)
