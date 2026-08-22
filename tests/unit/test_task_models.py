"""
Unit tests for Task, Milestone, and Action models.
"""

from deep_browser.models.action import ActionCall, DOMElement, VerificationResult
from deep_browser.models.task import Milestone, Task


def test_task_initialization():
    task = Task(goal="Search research papers on robotics", browser_mode="managed", profile_id="research")
    assert task.goal == "Search research papers on robotics"
    assert task.status == "pending"
    assert task.browser_mode == "managed"
    assert task.profile_id == "research"
    assert task.id.startswith("task_")
    assert len(task.milestones) == 0


def test_milestone_lifecycle():
    m = Milestone(title="Navigate to Google Scholar")
    assert m.status == "pending"
    assert m.id.startswith("m_")

    m.status = "completed"
    m.evidence = "Landed on scholar.google.com"
    assert m.status == "completed"
    assert m.evidence is not None


def test_action_call_schema():
    action = ActionCall(
        tool="type_text",
        params={"index": 1, "text": "Autonomous Navigation"},
        thought="Entering query into search box",
        expected_consequence="Search input contains 'Autonomous Navigation'",
        is_sensitive=False,
    )
    assert action.tool == "type_text"
    assert action.params["index"] == 1
    assert action.is_sensitive is False


def test_dom_element_schema():
    el = DOMElement(
        index=3,
        tag="button",
        text="Submit",
        selector="#submit-btn",
        is_interactive=True,
    )
    assert el.index == 3
    assert el.tag == "button"
    assert el.selector == "#submit-btn"
