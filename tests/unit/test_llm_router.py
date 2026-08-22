"""
Unit tests for LLM Router and Response parsing.
"""

from deep_browser.llm.providers import LLMResponse
from deep_browser.llm.router import ModelRouter


def test_llm_response_json_parsing():
    raw_text = """```json
    {
        "thought": "I will click the search button.",
        "action": {
            "tool": "click_element",
            "params": { "index": 2 }
        }
    }
    ```"""
    resp = LLMResponse(content=raw_text)
    assert resp.parsed_json is not None
    assert resp.parsed_json["thought"] == "I will click the search button."
    assert resp.parsed_json["action"]["tool"] == "click_element"
    assert resp.parsed_json["action"]["params"]["index"] == 2


def test_llm_response_raw_json_parsing():
    raw_text = '{"thought": "Navigate to docs", "action": {"tool": "navigate", "params": {"url": "https://docs.python.org"}}}'
    resp = LLMResponse(content=raw_text)
    assert resp.parsed_json is not None
    assert resp.parsed_json["action"]["tool"] == "navigate"


def test_model_router_fallback():
    router = ModelRouter()
    provider = router.get_provider("gemini")
    assert provider is not None
    assert hasattr(provider, "generate_action")
