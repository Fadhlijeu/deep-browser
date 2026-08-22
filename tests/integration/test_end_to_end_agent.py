"""
End-to-End Integration Test for Deep-Browser:
Tests real BrowserSession + Agent execution + VerificationEngine + EventBroadcaster + WorkspaceManager.
"""

import json
import pytest
from pytest_httpserver import HTTPServer

from browser_use import Agent, BrowserProfile, BrowserSession, Tools
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.verification.engine import VerificationEngine
from deep_browser.verification.models import ActionStage
from deep_browser.workspace.manager import WorkspaceManager
from tests.ci.conftest import create_mock_llm


@pytest.fixture(scope="module")
def local_web_server():
    server = HTTPServer()
    server.start()

    # Route: Home Search Page
    server.expect_request("/").respond_with_data(
        """
        <!DOCTYPE html>
        <html>
        <head><title>Deep-Browser Test Portal</title></head>
        <body>
            <h1>Search Portal</h1>
            <p id="portal-desc">Welcome to the Deep-Browser search test page.</p>
        </body>
        </html>
        """,
        content_type="text/html",
    )

    yield server
    server.stop()


@pytest.mark.asyncio
async def test_end_to_end_task_execution(local_web_server: HTTPServer, tmp_path):
    target_url = local_web_server.url_for("/")
    workspace = WorkspaceManager(base_dir=str(tmp_path))
    broadcaster = EventBroadcaster()
    verification = VerificationEngine()

    captured_events = []

    def on_event(evt: DeepBrowserEvent):
        captured_events.append(evt)

    broadcaster.subscribe(on_event)

    # Sequence of mock LLM actions:
    # 1. Navigate to target URL
    # 2. Complete task
    actions = [
        json.dumps({
            "evaluation_previous_goal": "Initial step",
            "memory": "Starting task",
            "next_goal": f"Navigate to {target_url}",
            "action": [
                {"navigate": {"url": target_url}}
            ]
        }),
        json.dumps({
            "evaluation_previous_goal": "Navigated to page",
            "memory": "Page loaded successfully",
            "next_goal": "Complete task",
            "action": [
                {"done": {"text": "Successfully reached search portal", "success": True}}
            ]
        })
    ]

    mock_llm = create_mock_llm(actions=actions)
    profile = BrowserProfile(headless=True)
    session = BrowserSession(browser_profile=profile)
    tools = Tools()

    agent = Agent(
        task="Navigate to the search portal",
        llm=mock_llm,
        browser_session=session,
        tools=tools,
        max_steps=3,
    )

    task_id = "task_e2e_001"

    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.TASK_STARTED,
            message="E2E test agent starting",
        )
    )

    # Capture initial state
    before_state = await verification.capture_state(agent)

    # Run agent loop
    result = await agent.run()

    # Capture after state
    after_state = await verification.capture_state(agent)

    # Run deterministic verification
    verif_res = await verification.verify_action(
        "navigate",
        {"url": target_url},
        before_state,
        after_state,
    )

    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.VERIFICATION,
            message=verif_res.details,
            data=verif_res.model_dump(),
        )
    )

    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.COMPLETED,
            message="E2E test task completed",
            data={"result": str(result)},
        )
    )

    # Save to workspace
    task_record = {
        "id": task_id,
        "task": "Navigate to the search portal",
        "result": str(result),
        "verified": verif_res.verified,
        "events": [e.model_dump() for e in captured_events],
    }
    saved_path = await workspace.save_task_record(task_id, task_record)

    # Clean up browser session
    await session.kill()

    # Assertions
    assert verif_res.verified is True
    assert verif_res.stage == ActionStage.VERIFIED
    assert len(captured_events) >= 3
    event_types = [e.event_type for e in captured_events]
    assert EventType.TASK_STARTED in event_types
    assert EventType.VERIFICATION in event_types
    assert EventType.COMPLETED in event_types

    loaded_record = await workspace.load_task_record(task_id)
    assert loaded_record is not None
    assert loaded_record["verified"] is True
    assert len(loaded_record["events"]) >= 3
