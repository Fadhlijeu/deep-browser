"""
Live Browser End-to-End Safe Mode Flow Integration Test:
Tests real BrowserSession + SafeTools + SafeModePolicy + Chromium CDP with user confirmation gateway.
"""

import asyncio
import json
import pytest
from pytest_httpserver import HTTPServer

from browser_use import Agent, BrowserProfile, BrowserSession
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModeManager, SafeModePolicy, SafeTools
from deep_browser.verification.engine import VerificationEngine
from tests.ci.conftest import create_mock_llm


@pytest.fixture(scope="module")
def sensitive_portal_server():
    server = HTTPServer()
    server.start()

    server.expect_request("/sensitive_form").respond_with_data(
        """
        <!DOCTYPE html>
        <html>
        <head><title>Account Settings</title></head>
        <body>
            <h1>Account Management</h1>
            <form action="/account_deleted" method="get">
                <input id="u" value="admin" />
                <button type="submit" id="btn">Hapus Akun</button>
            </form>
        </body>
        </html>
        """,
        content_type="text/html",
    )

    server.expect_request("/account_deleted").respond_with_data(
        """
        <!DOCTYPE html>
        <html>
        <head><title>Account Deleted</title></head>
        <body>
            <h1>Account Deleted Successfully</h1>
            <div id="status">DELETED</div>
        </body>
        </html>
        """,
        content_type="text/html",
    )

    yield server
    server.stop()


@pytest.mark.asyncio
async def test_live_safe_mode_confirmation_with_chromium(sensitive_portal_server: HTTPServer):
    portal_url = sensitive_portal_server.url_for("/sensitive_form")
    broadcaster = EventBroadcaster()
    events_log = []

    safe_manager = SafeModeManager.get_instance()
    safe_manager.clear()

    # Event-driven extension confirmation simulator
    def on_event(evt: DeepBrowserEvent):
        events_log.append(evt)
        if evt.event_type == EventType.CONFIRMATION_REQUIRED:
            conf_id = evt.data.get("confirmation_id")
            if conf_id:
                asyncio.create_task(resolve_shortly(conf_id))

    async def resolve_shortly(conf_id: str):
        await asyncio.sleep(0.05)
        safe_manager.resolve_confirmation(conf_id, "CONFIRM")

    broadcaster.subscribe(on_event)

    policy = SafeModePolicy(enabled=True, timeout_seconds=15.0)
    tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

    profile = BrowserProfile(headless=True)
    session = BrowserSession(browser_profile=profile)

    actions = [
        # Step 1: Navigate to sensitive form
        json.dumps({
            "evaluation_previous_goal": "Start",
            "memory": "Navigating to settings",
            "next_goal": f"Navigate to {portal_url}",
            "action": [
                {"navigate": {"url": portal_url}}
            ]
        }),
        # Step 2: Click "Hapus Akun" (element index 18)
        json.dumps({
            "evaluation_previous_goal": "Loaded settings",
            "memory": "Clicking delete button",
            "next_goal": "Click delete button",
            "action": [
                {"click": {"index": 18}}
            ]
        }),
        # Step 3: Done
        json.dumps({
            "evaluation_previous_goal": "Deleted",
            "memory": "Account deleted",
            "next_goal": "Finish task",
            "action": [
                {"done": {"text": "Account deletion completed", "success": True}}
            ]
        })
    ]

    mock_llm = create_mock_llm(actions=actions)

    agent = Agent(
        task="Navigate to settings and delete account",
        llm=mock_llm,
        browser_session=session,
        tools=tools,
        max_steps=5,
    )

    result = await agent.run()

    # Verify agent finished
    assert agent.history.is_done() is True

    # Verify Safe Mode event stream
    event_types = [e.event_type for e in events_log]
    assert EventType.CONFIRMATION_REQUIRED in event_types
    assert EventType.PAUSED_FOR_CONFIRMATION in event_types
    assert EventType.ACTION_CONFIRMED in event_types
    assert EventType.RESUMING in event_types

    # Verify browser physically reached /account_deleted
    urls = agent.history.urls()
    assert any("/account_deleted" in u for u in urls)

    await session.kill()
    safe_manager.clear()
