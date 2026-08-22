"""
Unit tests for Deep-Browser product layer (Verification, Events, Sessions, Workspace, Bridge).
"""

import pytest
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModePolicy
from deep_browser.verification.engine import VerificationEngine
from deep_browser.verification.models import ActionStage
from deep_browser.workspace.manager import WorkspaceManager


@pytest.mark.asyncio
async def test_event_broadcaster():
    broadcaster = EventBroadcaster()
    received = []

    def on_event(evt):
        received.append(evt)

    broadcaster.subscribe(on_event)
    evt = DeepBrowserEvent(
        task_id="test_task_1",
        event_type=EventType.TASK_CREATED,
        message="Test event",
    )
    await broadcaster.broadcast(evt)

    assert len(received) == 1
    assert received[0].task_id == "test_task_1"
    assert received[0].event_type == EventType.TASK_CREATED


@pytest.mark.asyncio
async def test_safe_mode_policy():
    policy = SafeModePolicy(enabled=True)
    req = policy.requires_confirmation("delete_user_account", {})
    assert req is not None
    assert req.risk_level == "high"

    req_safe = policy.requires_confirmation("scroll_down", {})
    assert req_safe is None


@pytest.mark.asyncio
async def test_verification_engine_navigation():
    engine = VerificationEngine()
    before = {"url": "https://example.com", "ready_state": "complete"}
    after = {"url": "https://example.com/about", "ready_state": "complete"}
    res = await engine.verify_action("navigate", {"url": "https://example.com/about"}, before, after)

    assert res.verified is True
    assert res.stage == ActionStage.VERIFIED
    assert len(res.evidence.mutations_observed) > 0


@pytest.mark.asyncio
async def test_workspace_manager(tmp_path):
    mgr = WorkspaceManager(base_dir=str(tmp_path))
    task_data = {"id": "task_123", "goal": "Search GitHub"}
    path = await mgr.save_task_record("task_123", task_data)

    loaded = await mgr.load_task_record("task_123")
    assert loaded is not None
    assert loaded["id"] == "task_123"
    assert loaded["goal"] == "Search GitHub"
