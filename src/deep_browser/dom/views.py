"""
DOM element views and accessibility representations.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DOMSnapshot(BaseModel):
    """Snapshot of the current interactive page state."""

    url: str
    title: str
    interactive_elements: List[Dict[str, Any]] = Field(default_factory=list)
    element_tree_text: str = ""
    viewport: Dict[str, int] = Field(default_factory=dict)
    scroll_position: Dict[str, int] = Field(default_factory=dict)
    timestamp: str = ""
