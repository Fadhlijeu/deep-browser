"""
Model router managing multi-provider selection and fallback.
"""

import logging
from typing import Optional
from deep_browser.config import settings
from deep_browser.llm.providers import (
    BaseLLMProvider,
    GeminiProvider,
    OllamaProvider,
    OpenAIProvider,
)

logger = logging.getLogger(__name__)


class ModelRouter:
    """Routes LLM requests to the configured provider."""

    def __init__(self):
        self._providers = {
            "gemini": GeminiProvider(),
            "openai": OpenAIProvider(),
            "ollama": OllamaProvider(),
        }

    def get_provider(self, provider_name: Optional[str] = None) -> BaseLLMProvider:
        name = (provider_name or settings.llm_provider).lower()
        if name in self._providers:
            return self._providers[name]
        # Default fallback
        logger.warning(f"Provider '{name}' not found, falling back to Gemini")
        return self._providers["gemini"]


model_router = ModelRouter()
