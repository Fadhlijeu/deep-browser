"""
Structured event timeline models for Deep-Browser.
"""

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
import time


class EventType(str, Enum):
    TASK_CREATED = "TASK_CREATED"
    TASK_STARTED = "TASK_STARTED"
    OBSERVATION = "OBSERVATION"
    REASONING = "REASONING"
    ACTION_REQUESTED = "ACTION_REQUESTED"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    VERIFICATION = "VERIFICATION"
    RECOVERY = "RECOVERY"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    CONFIRMATION_REQUESTED = "CONFIRMATION_REQUESTED"
    CONFIRMATION_RECEIVED = "CONFIRMATION_RECEIVED"
    ACTION_CONFIRMED = "ACTION_CONFIRMED"
    ACTION_REJECTED = "ACTION_REJECTED"
    ACTION_TIMED_OUT = "ACTION_TIMED_OUT"
    PAUSED_FOR_CONFIRMATION = "PAUSED_FOR_CONFIRMATION"
    PAUSED = "PAUSED"
    RESUMED = "RESUMED"
    RESUMING = "RESUMING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DeepBrowserEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{int(time.time() * 1000)}")
    task_id: str
    session_id: Optional[str] = None
    event_type: EventType
    timestamp: float = Field(default_factory=time.time)
    data: dict[str, Any] = Field(default_factory=dict)
    message: Optional[str] = None
