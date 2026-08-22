"""
Action models and verification schemas.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class DOMElement(BaseModel):
    index: int
    tag: str
    text: str = ""
    role: Optional[str] = None
    selector: str
    xpath: Optional[str] = None
    bounding_box: Dict[str, float] = Field(default_factory=dict)
    is_interactive: bool = True
    attributes: Dict[str, str] = Field(default_factory=dict)
    is_visible: bool = True


class ActionCall(BaseModel):
    tool: str
    params: Dict[str, Any] = Field(default_factory=dict)
    thought: str = ""
    expected_consequence: str = ""
    is_sensitive: bool = False


class VerificationResult(BaseModel):
    is_verified: bool
    status: Literal["VERIFIED", "FAILED", "SKIPPED"]
    assertion: str
    actual_state: str
    details: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class ActionReceipt(BaseModel):
    step_index: int
    timestamp: str
    action: ActionCall
    execution_success: bool
    execution_output: Optional[Any] = None
    verification: VerificationResult
    screenshot_path: Optional[str] = None
    page_url: str = ""
    page_title: str = ""
