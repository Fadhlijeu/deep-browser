"""
Deterministic verification models and evidence capture.
"""

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
import time


class ActionStage(str, Enum):
    PLANNED = "PLANNED"
    ATTEMPTED = "ATTEMPTED"
    EXECUTED = "EXECUTED"
    VERIFIED = "VERIFIED"
    COMMITTED = "COMMITTED"
    FAILED = "FAILED"


class Evidence(BaseModel):
    action_type: str
    target_selector: Optional[str] = None
    target_index: Optional[int] = None
    before_state: dict[str, Any] = Field(default_factory=dict)
    after_state: dict[str, Any] = Field(default_factory=dict)
    mutations_observed: list[str] = Field(default_factory=list)
    timestamp: float = Field(default_factory=time.time)
    screenshot_path: Optional[str] = None


class VerificationResult(BaseModel):
    verified: bool
    stage: ActionStage
    evidence: Evidence
    details: str
    confidence: float = 1.0
