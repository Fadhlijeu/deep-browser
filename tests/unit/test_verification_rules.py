"""
Unit tests for Verification Rules and Engine.
"""

import pytest
from deep_browser.models.action import ActionCall
from deep_browser.verification.engine import VerificationEngine
from deep_browser.verification.rules import NavigationRule


@pytest.mark.asyncio
async def test_navigation_rule_success():
    rule = NavigationRule()
    action = ActionCall(tool="navigate", params={"url": "https://example.com"})

    class MockSession:
        current_url = "https://example.com/welcome"

    pre_state = {"url": "about:blank"}
    result = await rule.verify(MockSession(), action, pre_state)

    assert result.is_verified is True
    assert result.status == "VERIFIED"


@pytest.mark.asyncio
async def test_navigation_rule_stalled():
    rule = NavigationRule()
    action = ActionCall(tool="navigate", params={"url": "https://example.com"})

    class MockSession:
        current_url = "about:blank"

    pre_state = {"url": "about:blank"}
    result = await rule.verify(MockSession(), action, pre_state)

    assert result.is_verified is False
    assert result.status == "FAILED"
    assert "Navigation stalled" in (result.error_message or "")


@pytest.mark.asyncio
async def test_verification_engine_fallback():
    engine = VerificationEngine()
    action = ActionCall(tool="custom_unknown_action", params={})

    class MockSession:
        current_url = "https://test.com"

    result = await engine.verify_action(MockSession(), action, {})
    assert result.is_verified is True
    assert result.status == "VERIFIED"
