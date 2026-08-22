"""
Structured event timeline models for Deep-Browser.
"""

from enum import Enum
from typing import Any, Optional, Union
from pydantic import BaseModel, Field
import time


class EventType(str, Enum):
    TASK_CREATED = "TASK_CREATED"
    TASK_STARTED = "TASK_STARTED"
    OBSERVATION = "OBSERVATION"
    REASONING = "REASONING"
    THINKING = "THINKING"
    ACTION_REQUESTED = "ACTION_REQUESTED"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    NAVIGATE = "NAVIGATE"
    CLICK = "CLICK"
    TYPE = "TYPE"
    PRESS_KEY = "PRESS_KEY"
    SCROLL = "SCROLL"
    WAIT = "WAIT"
    VERIFICATION = "VERIFICATION"
    RECOVERY = "RECOVERY"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    CONFIRMATION_REQUESTED = "CONFIRMATION_REQUESTED"
    CONFIRMATION_RECEIVED = "CONFIRMATION_RECEIVED"
    ACTION_CONFIRMED = "ACTION_CONFIRMED"
    ACTION_REJECTED = "ACTION_REJECTED"
    ACTION_TIMED_OUT = "ACTION_TIMED_OUT"
    PAUSED_FOR_CONFIRMATION = "PAUSED_FOR_CONFIRMATION"
    CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED"
    CHALLENGE_RESOLVED = "CHALLENGE_RESOLVED"
    CHALLENGE_TIMEOUT = "CHALLENGE_TIMEOUT"
    WATCHDOG_TIMEOUT = "WATCHDOG_TIMEOUT"
    BLOCKED = "BLOCKED"
    PAUSED = "PAUSED"
    RESUMED = "RESUMED"
    RESUMING = "RESUMING"
    STOPPED = "STOPPED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SESSION_CREATED = "SESSION_CREATED"
    SESSION_SWITCHED = "SESSION_SWITCHED"
    SESSION_CLOSED = "SESSION_CLOSED"
    SESSION_ATTACHED = "SESSION_ATTACHED"
    SESSION_HANDOFF_REQUESTED = "SESSION_HANDOFF_REQUESTED"
    SESSION_HANDOFF_COMPLETED = "SESSION_HANDOFF_COMPLETED"
    BROWSER_STATE_UPDATED = "BROWSER_STATE_UPDATED"


class DeepBrowserEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{int(time.time() * 1000)}")
    task_id: str
    session_id: Optional[str] = None
    owner: str = Field(default="EXTENSION")  # "WORKSPACE" | "EXTENSION"
    origin: Optional[str] = None
    tag: Optional[str] = None
    browser_mode: str = Field(default="MANAGED")  # "MANAGED" | "ATTACHED"
    browser_id: Optional[str] = None
    tab_id: Optional[Union[str, int]] = None
    event_type: EventType
    timestamp: float = Field(default_factory=time.time)
    action: Optional[str] = None
    target: Optional[str] = None
    status: Optional[str] = None
    verification: Optional[str] = None
    summary: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)
    message: Optional[str] = None
