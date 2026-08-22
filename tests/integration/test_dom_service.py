"""
Integration test for DOMService element tree generation and attribute redactions.
"""

import pytest
from deep_browser.dom.service import DOMService


@pytest.mark.asyncio
async def test_dom_service_extraction_and_redaction():
    class MockDOMSession:
        current_url = "https://portal.example.org"
        current_title = "Portal Login"
        cached_elements = []

        async def evaluate(self, script, *args, **kwargs):
            return {
                "url": "https://portal.example.org",
                "title": "Portal Login",
                "interactive_elements": [
                    {
                        "index": 1,
                        "tag": "input",
                        "text": "admin@example.org",
                        "role": "textbox",
                        "selector": "#email",
                        "attributes": {"placeholder": "Enter email"},
                        "is_interactive": True,
                        "is_visible": True,
                    },
                    {
                        "index": 2,
                        "tag": "input",
                        "text": "[REDACTED_PASSWORD]",
                        "role": "textbox",
                        "selector": "#pwd",
                        "attributes": {"type": "password"},
                        "is_interactive": True,
                        "is_visible": True,
                    },
                    {
                        "index": 3,
                        "tag": "button",
                        "text": "Sign In",
                        "role": "button",
                        "selector": "#btn-signin",
                        "attributes": {},
                        "is_interactive": True,
                        "is_visible": True,
                    },
                ],
                "viewport": {"width": 1280, "height": 800},
                "scroll_position": {"x": 0, "y": 0},
            }

    session = MockDOMSession()
    snapshot = await DOMService.extract_dom_snapshot(session)

    assert snapshot.url == "https://portal.example.org"
    assert snapshot.title == "Portal Login"
    assert len(snapshot.interactive_elements) == 3
    assert len(session.cached_elements) == 3

    # Check generated element tree text
    assert "[1] <input>" in snapshot.element_tree_text
    assert "[REDACTED_PASSWORD]" in snapshot.element_tree_text
    assert "[3] <button>" in snapshot.element_tree_text
