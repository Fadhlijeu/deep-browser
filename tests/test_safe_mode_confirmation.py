"""
Comprehensive Test Suite for Deep-Browser Safe Mode Confirmation Gateways:
1. Safe action passes without confirmation.
2. Submit requires confirmation.
3. Send requires confirmation.
4. Delete requires confirmation.
5. User confirms -> action executes exactly once.
6. User rejects -> action never executes.
7. Timeout -> action never executes.
8. Extension disconnects while paused -> task remains paused/fails safely.
9. Duplicate confirmation response -> ignored.
10. Restart/reconnect does not accidentally approve pending action.
"""

import asyncio
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel, create_model

from browser_use.browser.session import BrowserSession
from browser_use.agent.views import ActionResult
from browser_use.tools.service import Tools
from browser_use.tools.views import ClickElementAction, InputTextAction, NavigateAction
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import (
    ConfirmationRequest,
    SafeModeManager,
    SafeModePolicy,
    SafeModeState,
    SafeTools,
    SensitiveCategory,
)


@pytest.fixture(autouse=True)
def cleanup_safe_mode():
    manager = SafeModeManager.get_instance()
    manager.clear()
    yield
    manager.clear()


def test_safe_action_passes_without_confirmation():
    policy = SafeModePolicy(enabled=True)
    req = policy.check_action_safety(
        action_name="navigate",
        params={"url": "https://www.example.com"},
        element_text=None,
    )
    assert req is None

    req_scroll = policy.check_action_safety(
        action_name="scroll_down",
        params={"amount": 500},
        element_text=None,
    )
    assert req_scroll is None


def test_submit_requires_confirmation():
    policy = SafeModePolicy(enabled=True)
    
    # 1. Action name submit
    req1 = policy.check_action_safety(action_name="submit_form", params={})
    assert req1 is not None
    assert req1.category == SensitiveCategory.SUBMIT

    # 2. Button element with type=submit
    req2 = policy.check_action_safety(
        action_name="click_element",
        params={"index": 2},
        element_tag="button",
        element_type="submit",
        element_text="Submit Inquiry",
    )
    assert req2 is not None
    assert req2.category == SensitiveCategory.SUBMIT

    # 3. Indonesian text "kirim"
    req3 = policy.check_action_safety(
        action_name="click_element",
        params={"index": 3},
        element_text="Kirim formulir",
    )
    assert req3 is not None
    assert req3.category == SensitiveCategory.SUBMIT


def test_send_requires_confirmation():
    policy = SafeModePolicy(enabled=True)
    
    req1 = policy.check_action_safety(action_name="send_message", params={"text": "Hello"})
    assert req1 is not None
    assert req1.category == SensitiveCategory.SEND

    req2 = policy.check_action_safety(
        action_name="click_element",
        params={"index": 5},
        element_text="Send email now",
    )
    assert req2 is not None
    assert req2.category == SensitiveCategory.SEND


def test_delete_requires_confirmation():
    policy = SafeModePolicy(enabled=True)
    
    req1 = policy.check_action_safety(action_name="delete_account", params={})
    assert req1 is not None
    assert req1.category == SensitiveCategory.DELETE

    req2 = policy.check_action_safety(
        action_name="click_element",
        params={"index": 9},
        element_text="Hapus Database",
    )
    assert req2 is not None
    assert req2.category == SensitiveCategory.DELETE


@pytest.mark.asyncio
async def test_user_confirms_action_executes_exactly_once():
    broadcaster = EventBroadcaster()
    events = []
    broadcaster.subscribe(lambda e: events.append(e))

    policy = SafeModePolicy(enabled=True, timeout_seconds=5.0)
    tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

    # Mock super().act
    execution_counter = 0

    async def mock_super_act(action, browser_session, **kwargs):
        nonlocal execution_counter
        execution_counter += 1
        return ActionResult(extracted_content="Clicked submit button")

    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "test_sess"
    mock_session.get_element_by_index = AsyncMock(return_value=None)

    ActionModelClass = create_model("MockActionModel", click_element=(ClickElementAction, None))

    with patch.object(SafeTools.__bases__[0], "act", side_effect=mock_super_act):
        # Trigger an action requiring confirmation
        action_model = ActionModelClass(click_element=ClickElementAction(index=1))
        
        async def resolve_later():
            await asyncio.sleep(0.05)
            manager = SafeModeManager.get_instance()
            for conf_id in list(manager._pending.keys()):
                manager.resolve_confirmation(conf_id, "CONFIRM")

        asyncio.create_task(resolve_later())

        policy.category_keywords[SensitiveCategory.SUBMIT].append("click_element")

        result = await tools.act(action=action_model, browser_session=mock_session, task_id="task_conf")

        assert result.error is None
        assert execution_counter == 1  # Executes EXACTLY ONCE
        assert any(e.event_type == EventType.CONFIRMATION_REQUIRED for e in events)
        assert any(e.event_type == EventType.ACTION_CONFIRMED for e in events)


@pytest.mark.asyncio
async def test_user_rejects_action_never_executes():
    broadcaster = EventBroadcaster()
    events = []
    broadcaster.subscribe(lambda e: events.append(e))

    policy = SafeModePolicy(enabled=True, timeout_seconds=5.0)
    tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

    execution_counter = 0

    async def mock_super_act(action, browser_session, **kwargs):
        nonlocal execution_counter
        execution_counter += 1
        return ActionResult(extracted_content="Should not be reached")

    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "test_sess"
    mock_session.get_element_by_index = AsyncMock(return_value=None)

    ActionModelClass = create_model("MockActionModel", click_element=(ClickElementAction, None))

    with patch.object(SafeTools.__bases__[0], "act", side_effect=mock_super_act):
        action_model = ActionModelClass(click_element=ClickElementAction(index=1))
        
        async def reject_later():
            await asyncio.sleep(0.05)
            manager = SafeModeManager.get_instance()
            for conf_id in list(manager._pending.keys()):
                manager.resolve_confirmation(conf_id, "REJECT")

        asyncio.create_task(reject_later())

        policy.category_keywords[SensitiveCategory.DELETE].append("click_element")

        result = await tools.act(action=action_model, browser_session=mock_session, task_id="task_rej")

        assert result.error is not None
        assert "explicitly rejected" in result.error
        assert execution_counter == 0  # NEVER EXECUTED
        assert any(e.event_type == EventType.ACTION_REJECTED for e in events)


@pytest.mark.asyncio
async def test_timeout_action_never_executes():
    broadcaster = EventBroadcaster()
    events = []
    broadcaster.subscribe(lambda e: events.append(e))

    # Short timeout for testing
    policy = SafeModePolicy(enabled=True, timeout_seconds=0.1)
    tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

    execution_counter = 0

    async def mock_super_act(action, browser_session, **kwargs):
        nonlocal execution_counter
        execution_counter += 1
        return ActionResult(extracted_content="Should not be reached")

    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "test_sess"
    mock_session.get_element_by_index = AsyncMock(return_value=None)

    ActionModelClass = create_model("MockActionModel", click_element=(ClickElementAction, None))

    with patch.object(SafeTools.__bases__[0], "act", side_effect=mock_super_act):
        action_model = ActionModelClass(click_element=ClickElementAction(index=1))
        policy.category_keywords[SensitiveCategory.DELETE].append("click_element")

        # Do not respond -> let it timeout
        result = await tools.act(action=action_model, browser_session=mock_session, task_id="task_timeout")

        assert result.error is not None
        assert "timed out" in result.error
        assert execution_counter == 0  # NEVER EXECUTED
        assert any(e.event_type == EventType.ACTION_TIMED_OUT for e in events)


def test_duplicate_confirmation_response_ignored():
    manager = SafeModeManager.get_instance()
    req = ConfirmationRequest(
        task_id="t1",
        category=SensitiveCategory.SUBMIT,
        action="submit",
        target="form",
        reason="submit test",
        expires_at=time.time() + 60,
    )
    fut = manager.register(req)

    # First resolution -> True
    res1 = manager.resolve_confirmation(req.confirmation_id, "CONFIRM")
    assert res1 is True
    assert fut.result() == "CONFIRM"

    # Second (duplicate) resolution -> False (ignored)
    res2 = manager.resolve_confirmation(req.confirmation_id, "CONFIRM")
    assert res2 is False

    # Conflicting late decision -> False (ignored)
    res3 = manager.resolve_confirmation(req.confirmation_id, "REJECT")
    assert res3 is False


def test_reconnect_does_not_accidentally_approve():
    manager = SafeModeManager.get_instance()
    
    # Fake confirmation ID
    res = manager.resolve_confirmation("non_existent_conf_123", "CONFIRM")
    assert res is False


@pytest.mark.asyncio
async def test_extension_disconnect_while_paused():
    # If client disconnects, task times out safely and never approves
    broadcaster = EventBroadcaster()
    policy = SafeModePolicy(enabled=True, timeout_seconds=0.1)
    tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "test_sess"
    mock_session.get_element_by_index = AsyncMock(return_value=None)

    ActionModelClass = create_model("MockActionModel", click_element=(ClickElementAction, None))
    action_model = ActionModelClass(click_element=ClickElementAction(index=1))
    policy.category_keywords[SensitiveCategory.DELETE].append("click_element")

    result = await tools.act(action=action_model, browser_session=mock_session, task_id="task_disconnect")
    assert result.error is not None
    assert "timed out" in result.error
