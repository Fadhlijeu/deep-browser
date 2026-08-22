"""
Task, Milestone, and Session data models.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4
from pydantic import BaseModel, Field
from deep_browser.models.action import ActionReceipt


class Milestone(BaseModel):
    id: str = Field(default_factory=lambda: f"m_{uuid4().hex[:6]}")
    title: str
    description: str = ""
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    evidence: Optional[str] = None


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    llm_calls: int = 0


class Task(BaseModel):
    id: str = Field(default_factory=lambda: f"task_{uuid4().hex[:8]}")
    goal: str
    status: Literal[
        "pending",
        "planning",
        "running",
        "waiting_confirmation",
        "verifying",
        "recovering",
        "paused",
        "completed",
        "failed",
        "cancelled",
    ] = "pending"
    browser_mode: Literal["attached", "managed"] = "managed"
    profile_id: str = "default"
    session_id: Optional[str] = None
    milestones: List[Milestone] = Field(default_factory=list)
    current_milestone_index: int = 0
    history: List[ActionReceipt] = Field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 3
    token_usage: TokenUsage = Field(default_factory=TokenUsage)
    pending_confirmation_action: Optional[Dict[str, Any]] = None
    result_summary: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def update_timestamp(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()
