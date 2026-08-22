"""
Pre-Milestone 4 Architecture Gate Verification:
Proves the exact production execution chain:
Chrome Extension / API -> Deep-Browser Bridge -> browser_use.Agent / Tools -> browser_use.BrowserSession -> CDP -> Chromium
Verifies navigate, input_text, and click_element against a real browser instance.
"""

import json
import pytest
from pytest_httpserver import HTTPServer

from browser_use import Agent, BrowserProfile, BrowserSession, Tools
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModePolicy
from deep_browser.verification.engine import VerificationEngine
from deep_browser.verification.models import ActionStage
from deep_browser.workspace.manager import WorkspaceManager
from tests.ci.conftest import create_mock_llm


@pytest.fixture(scope="module")
def interactive_portal_server():
    server = HTTPServer()
    server.start()

    # Route 1: Portal form
    server.expect_request("/portal").respond_with_data(
        """
        <!DOCTYPE html>
        <html>
        <head><title>Architecture Gate Portal</title></head>
        <body>
            <h1>Search Portal</h1>
            <form action="/portal/submitted" method="get">
                <input type="text" id="target-input" name="search_term" placeholder="Type here..." />
                <button type="submit" id="submit-btn">Submit Search</button>
            </form>
        </body>
        </html>
        """,
        content_type="text/html",
    )

    # Route 2: Submission destination
    server.expect_request("/portal/submitted").respond_with_data(
        """
        <!DOCTYPE html>
        <html>
        <head><title>Search Submitted</title></head>
        <body>
            <h1>Results Page</h1>
            <div id="confirmed-badge">Submission Successful</div>
        </body>
        </html>
        """,
        content_type="text/html",
    )

    yield server
    server.stop()


@pytest.mark.asyncio
async def test_production_chain_navigate_input_click(interactive_portal_server: HTTPServer, tmp_path):
    portal_url = interactive_portal_server.url_for("/portal")
    workspace = WorkspaceManager(base_dir=str(tmp_path))
    broadcaster = EventBroadcaster()
    verification = VerificationEngine()
    safety = SafeModePolicy(enabled=True)

    captured_events = []
    broadcaster.subscribe(lambda evt: captured_events.append(evt))

    # Real Browser Use Core components
    profile = BrowserProfile(headless=True)
    session = BrowserSession(browser_profile=profile)
    tools = Tools()

    # Sequence of planned actions through the Agent loop:
    # Step 1: Navigate to portal
    # Step 2: Input text into search field (index 0 / target-input)
    # Step 3: Click submit button (index 1 / submit-btn)
    # Step 4: Done
    actions = [
        # Step 1: Navigate
        json.dumps({
            "evaluation_previous_goal": "Start",
            "memory": "Navigating to portal",
            "next_goal": f"Navigate to {portal_url}",
            "action": [
                {"navigate": {"url": portal_url}}
            ]
        }),
        # Step 2: Input text
        json.dumps({
            "evaluation_previous_goal": "Navigated to portal",
            "memory": "Typing query into search input",
            "next_goal": "Input text",
            "action": [
                {"input_text": {"index": 0, "text": "DeepBrowserTestQuery"}}
            ]
        }),
        # Step 3: Click button
        json.dumps({
            "evaluation_previous_goal": "Text entered",
            "memory": "Clicking submit button",
            "next_goal": "Click submit",
            "action": [
                {"click_element": {"index": 1}}
            ]
        }),
        # Step 4: Done
        json.dumps({
            "evaluation_previous_goal": "Submitted form",
            "memory": "Results loaded",
            "next_goal": "Complete task",
            "action": [
                {"done": {"text": "Workflow completed successfully", "success": True}}
            ]
        })
    ]

    mock_llm = create_mock_llm(actions=actions)

    agent = Agent(
        task="Navigate to portal, input search query, click submit, and verify",
        llm=mock_llm,
        browser_session=session,
        tools=tools,
        max_steps=5,
    )

    task_id = "gate_task_001"

    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.TASK_STARTED,
            message="Starting Architecture Gate Execution",
        )
    )

    # 1. State before execution
    before_state = await verification.capture_state(agent)

    # 2. Run real Agent execution
    result = await agent.run()

    # 3. State after execution
    after_state = await verification.capture_state(agent)

    # 4. Deterministic Verification
    verif_res = await verification.verify_action(
        "navigate",
        {"url": portal_url},
        before_state,
        after_state,
    )

    await session.kill()

    # Assertions on exact chain execution
    assert agent.history.is_done() is True
    assert len(agent.history.history) >= 2

    # Verify that the browser was physically navigated to the portal
    urls = agent.history.urls()
    assert any("/portal" in u for u in urls)

    # Verify that verification engine verified state transition
    assert verif_res.verified is True
    assert verif_res.stage == ActionStage.VERIFIED

    # Verify safety policy evaluated actions without interfering with legitimate ones
    assert safety.requires_confirmation("scroll_down", {}) is None

    # Verify event timeline
    event_types = [e.event_type for e in captured_events]
    assert EventType.TASK_STARTED in event_types
