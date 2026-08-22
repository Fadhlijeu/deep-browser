"""
LLM Provider integrations for Deep-Browser.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from deep_browser.config import settings
from deep_browser.models.task import TokenUsage

logger = logging.getLogger(__name__)


class LLMResponse:
    def __init__(self, content: str, token_usage: Optional[TokenUsage] = None):
        self.content = content
        self.token_usage = token_usage or TokenUsage()
        self.parsed_json: Optional[Dict[str, Any]] = None
        self._parse_json()

    def _parse_json(self) -> None:
        """Extract structured JSON from model response."""
        text = self.content.strip()
        # Handle markdown code blocks
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()
        try:
            self.parsed_json = json.loads(text)
        except Exception:
            # Fallback: try finding first { and last }
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                try:
                    self.parsed_json = json.loads(text[start : end + 1])
                except Exception:
                    self.parsed_json = None


class BaseLLMProvider:
    """Abstract interface for LLM inference."""

    async def generate_action(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        raise NotImplementedError


class GeminiProvider(BaseLLMProvider):
    """Google Gemini Provider using google-genai or direct REST."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key or settings.gemini_api_key
        self.model = model

    async def generate_action(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set. Please provide it in .env or settings.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": f"System:\n{system_prompt}\n\nUser Task:\n{user_prompt}"}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code != 200:
                raise RuntimeError(f"Gemini API error ({res.status_code}): {res.text}")
            data = res.json()

        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = parts[0].get("text", "{}") if parts else "{}"

        usage_meta = data.get("usageMetadata", {})
        usage = TokenUsage(
            prompt_tokens=usage_meta.get("promptTokenCount", 0),
            completion_tokens=usage_meta.get("candidatesTokenCount", 0),
            total_tokens=usage_meta.get("totalTokenCount", 0),
            llm_calls=1,
        )

        return LLMResponse(content=text, token_usage=usage)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI / OpenAI-Compatible Provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o", base_url: Optional[str] = None):
        self.api_key = api_key or settings.openai_api_key or "sk-placeholder"
        self.model = model
        self.base_url = (base_url or settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")

    async def generate_action(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        url = f"{self.base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"OpenAI API error ({res.status_code}): {res.text}")
            data = res.json()

        choice = data["choices"][0]
        text = choice["message"]["content"]
        raw_usage = data.get("usage", {})
        usage = TokenUsage(
            prompt_tokens=raw_usage.get("prompt_tokens", 0),
            completion_tokens=raw_usage.get("completion_tokens", 0),
            total_tokens=raw_usage.get("total_tokens", 0),
            llm_calls=1,
        )

        return LLMResponse(content=text, token_usage=usage)


class OllamaProvider(OpenAIProvider):
    """Local Ollama / vLLM provider using OpenAI compatibility endpoint."""

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        target_base = base_url or settings.ollama_base_url
        target_model = model or settings.ollama_model
        super().__init__(api_key="ollama", model=target_model, base_url=target_base)
