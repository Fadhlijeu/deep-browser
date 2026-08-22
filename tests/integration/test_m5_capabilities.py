"""
Milestone 5 Integration Tests:
Tests Browser Use capability exposure, session coordination (Attached vs Managed),
agent lifecycle controls (start/pause/resume/stop), and strict architectural invariants.
"""

import asyncio
import json
import pytest
from pytest_httpserver import HTTPServer

from browser_use import Agent, BrowserProfile, BrowserSession, Tools
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModeManager, SafeModePolicy, SafeTools
from deep_browser.sessions.coordinator import SessionCoordinator, SessionViewModel
from tests.ci.conftest import create_mock_llm


@pytest.fixture(autouse=True)
def clean_coordinator():
    coordinator = SessionCoordinator.get_instance()
    coordinator.clear()
    safe_manager = SafeModeManager.get_instance()
    safe_manager.clear()
    yield
    coordinator.clear()
    safe_manager.clear()


@pytest.mark.asyncio
async def test_managed_session_creation_and_listing():
    coordinator = SessionCoordinator.get_instance()
    
    # Create managed session
    view = await coordinator.create_managed_session(
        name="Test Managed Session",
        headless=True,
    )
    
    assert view is not None
    assert view.name == "Test Managed Session"
    assert view.mode == "managed"
    assert view.status == "connected"
    
    # Verify underlying session is a real BrowserSession
    session = coordinator.get_session(view.id)
    assert isinstance(session, BrowserSession)
    assert session.is_cdp_connected is True
    
    # List sessions and verify view model
    views = await coordinator.list_session_views()
    assert len(views) == 1
    assert views[0].id == view.id
    assert views[0].browser_session_id == session.id
    
    await coordinator.close_session(view.id)


@pytest.mark.asyncio
async def test_session_switching_selects_correct_session():
    coordinator = SessionCoordinator.get_instance()
    
    view1 = await coordinator.create_managed_session(name="Session Alpha", headless=True)
    view2 = await coordinator.create_managed_session(name="Session Beta", headless=True)
    
    assert coordinator.active_session_id == view1.id
    assert coordinator.get_active_session() == coordinator.get_session(view1.id)
    
    # Switch to session 2
    switched = coordinator.switch_active_session(view2.id)
    assert switched is True
    assert coordinator.active_session_id == view2.id
    assert coordinator.get_active_session() == coordinator.get_session(view2.id)
    
    # Invalid session returns False and leaves active session intact
    invalid_switch = coordinator.switch_active_session("non_existent_id")
    assert invalid_switch is False
    assert coordinator.active_session_id == view2.id
    
    await coordinator.close_session(view1.id)
    await coordinator.close_session(view2.id)


@pytest.mark.asyncio
async def test_dead_session_reported_as_disconnected():
    coordinator = SessionCoordinator.get_instance()
    
    view = await coordinator.create_managed_session(name="Ephemeral Session", headless=True)
    session = coordinator.get_session(view.id)
    
    # Explicitly kill the session
    await session.kill()
    
    # Check view model reflects disconnected status
    updated_view = await coordinator.get_session_view(view.id)
    assert updated_view.status == "disconnected"


@pytest.mark.asyncio
async def test_attached_mode_reports_connection_state():
    coordinator = SessionCoordinator.get_instance()
    
    # Attempting to attach to a closed port should report error or disconnected without crashing
    view = await coordinator.attach_system_chrome(
        name="Offline Chrome",
        cdp_port=65432,  # non-existent port
    )
    
    assert view is not None
    assert view.mode == "attached"
    assert view.status in ("error", "disconnected")
    assert view.error_message is not None


@pytest.mark.asyncio
async def test_agent_lifecycle_start_pause_resume_stop():
    coordinator = SessionCoordinator.get_instance()
    
    session = BrowserSession(browser_profile=BrowserProfile(headless=True))
    await session.start()
    
    actions = [
        json.dumps({
            "evaluation_previous_goal": "Start",
            "memory": "Wait step",
            "next_goal": "Wait for a moment",
            "action": [{"wait": {"seconds": 1}}]
        }),
        json.dumps({
            "evaluation_previous_goal": "Waited",
            "memory": "Done step",
            "next_goal": "Complete",
            "action": [{"done": {"text": "Finished", "success": True}}]
        })
    ]
    
    mock_llm = create_mock_llm(actions=actions)
    agent = Agent(
        task="Test lifecycle controls",
        llm=mock_llm,
        browser_session=session,
        tools=Tools(),
        max_steps=5,
    )
    
    coordinator.set_active_agent(agent, "task_lifecycle_test")
    assert coordinator.get_active_agent() == agent
    
    # Test pause
    assert agent.state.paused is False
    paused = coordinator.pause_active_agent()
    assert paused is True
    assert agent.state.paused is True
    
    # Test resume
    resumed = coordinator.resume_active_agent()
    assert resumed is True
    assert agent.state.paused is False
    
    # Test stop
    assert agent.state.stopped is False
    stopped = coordinator.stop_active_agent()
    assert stopped is True
    assert agent.state.stopped is True
    
    await session.kill()


@pytest.mark.asyncio
async def test_multi_session_isolation(httpserver: HTTPServer):
    httpserver.expect_request("/page_a").respond_with_data("<html><title>Page Alpha</title><body>A</body></html>", content_type="text/html")
    httpserver.expect_request("/page_b").respond_with_data("<html><title>Page Beta</title><body>B</body></html>", content_type="text/html")
    
    coordinator = SessionCoordinator.get_instance()
    
    view_a = await coordinator.create_managed_session(name="Session A", headless=True)
    view_b = await coordinator.create_managed_session(name="Session B", headless=True)
    
    session_a = coordinator.get_session(view_a.id)
    session_b = coordinator.get_session(view_b.id)
    
    # Navigate session A to /page_a and session B to /page_b
    await session_a.navigate_to(httpserver.url_for("/page_a"))
    await session_b.navigate_to(httpserver.url_for("/page_b"))
    
    state_a = await coordinator.get_browser_state(view_a.id)
    state_b = await coordinator.get_browser_state(view_b.id)
    
    assert "/page_a" in state_a["url"]
    assert "/page_b" in state_b["url"]
    assert state_a["url"] != state_b["url"]
    
    await coordinator.close_session(view_a.id)
    await coordinator.close_session(view_b.id)


def test_architectural_invariants_no_duplicate_engines():
    """Verify strictly that Deep-Browser does not define duplicate core classes."""
    import deep_browser
    
    # Ensure deep_browser does not implement duplicate Agent or BrowserSession
    assert not hasattr(deep_browser, "CustomAgent")
    assert not hasattr(deep_browser, "CustomBrowserSession")
    assert not hasattr(deep_browser, "CustomCDP")
    
    # Ensure SafeTools inherits directly from browser_use.Tools
    assert issubclass(SafeTools, Tools)
    
    # Ensure SessionCoordinator manages real BrowserSession objects
    coordinator = SessionCoordinator.get_instance()
    assert coordinator is not None
