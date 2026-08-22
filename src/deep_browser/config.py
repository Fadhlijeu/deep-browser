"""
Configuration management for Deep-Browser.
"""

from pathlib import Path
from typing import Literal, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="DEEP_BROWSER_",
    )

    # Server & IPC
    host: str = "127.0.0.1"
    port: int = 8765
    debug: bool = False

    # Workspace Root
    workspace_dir: Path = Path("workspace").resolve()

    # Browser Defaults
    default_browser_mode: Literal["attached", "managed"] = "managed"
    attached_cdp_port: int = 9222
    attached_cdp_url: Optional[str] = None
    managed_headless: bool = False
    managed_viewport_width: int = 1280
    managed_viewport_height: int = 800
    max_concurrent_browsers: int = 4

    # LLM Configuration
    llm_provider: Literal["gemini", "openai", "anthropic", "ollama", "custom"] = "gemini"
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = "gemini-2.5-flash"

    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o"
    openai_base_url: Optional[str] = None

    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-3-7-sonnet-20250219"

    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5:latest"

    # Agent & Verification Settings
    safe_mode: bool = True
    max_steps_per_task: int = 30
    max_retries_per_step: int = 3
    action_timeout_seconds: float = 15.0
    settle_delay_seconds: float = 0.5


settings = Settings()
