"""
Integration test for Deep-Browser agent observe-act-verify cycle.
"""

import json
from typing import Any, Dict
import pytest
from deep_browser.agent.core import DeepBrowserAgent
from deep_browser.llm.providers import BaseLLMProvider, LLMResponse
from deep_browser.models.task import Task, TokenUsage


class MockTestingProvider(BaseLLMProvider):
    """Mock LLM provider returning predetermined deterministic action steps."""

    def __init__(self):
        self.step = 0

    async def generate_action(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        self.step += 1
        if self.step == 1:
            data = {
                "thought": "Navigating to starting portal",
                "milestone_plan": [
                    {"title": "Open target URL", "status": "in_progress"},
                    {"title": "Verify page arrival", "status": "pending"},
                ],
                "action": {
                    "tool": "scroll",
                    "params": {"direction": "down", "amount": 200},
                    "expected_consequence": "Page scrolls down",
                    "is_sensitive": False,
                },
            }
        else:
            data = {
                "thought": "Goal accomplished",
                "milestone_plan": [
                    {"title": "Open target URL", "status": "completed"},
                    {"title": "Verify page arrival", "status": "completed"},
                ],
                "action": {
                    "tool": "complete_task",
                    "params": {"summary": "Successfully verified navigation and scroll."},
                    "expected_consequence": "Task marked complete",
                    "is_sensitive": False,
                },
            }

        return LLMResponse(
            content=json.dumps(data),
            token_usage=TokenUsage(prompt_tokens=150, completion_tokens=50, total_tokens=200, llm_calls=1),
        )


@pytest.mark.asyncio
async def test_agent_supervisory_step_cycle(monkeypatch):
    """Test full agent loop with mocked browser session and mock LLM provider."""
    task = Task(goal="Verify agent supervisory loop", browser_mode="managed")

    mock_provider = MockTestingProvider()
    monkeypatch.setattr("deep_browser.llm.router.model_router.get_provider", lambda *args: mock_provider)

    class MockSession:
        session_id = "test_session"
        profile_id = "default"
        current_url = "https://example.com"
        current_title = "Example Domain"
        cached_elements = []

        async def evaluate(self, expr, *args, **kwargs):
            return {
                "url": "https://example.com",
                "title": "Example Domain",
                "interactive_elements": [
                    {
                        "index": 1,
                        "tag": "a",
                        "text": "More information...",
                        "selector": "a",
                        "attributes": {"href": "https://www.iana.org/domains/example"},
                        "is_interactive": True,
                        "is_visible": True,
                    }
                ],
            }

        async def update_page_state(self):
            return {"url": self.current_url, "title": self.current_title}

        async def capture_screenshot(self, *args):
            return ""

        async def scroll(self, *args, **kwargs):
            pass

    async def mock_get_session(*args, **kwargs):
        return MockSession()

    monkeypatch.setattr(
        "deep_browser.browser.runtime.browser_manager.get_or_create_session",
        mock_get_session,
    )

    events_received = []

    def event_collector(event_type: str, data: Dict[str, Any]):
        events_received.append((event_type, data))

    agent = DeepBrowserAgent(task=task, on_event=event_collector)
    completed_task = await agent.run()

    assert completed_task.status == "completed"
    assert completed_task.token_usage.total_tokens > 0
    assert len(completed_task.history) >= 1
    assert completed_task.history[0].verification.is_verified is True

    event_types = [e[0] for e in events_received]
    assert "TASK_STARTED" in event_types
    assert "STEP_PLANNED" in event_types
    assert "ACTION_RECEIPT" in event_types
    assert "TASK_COMPLETED" in event_types
