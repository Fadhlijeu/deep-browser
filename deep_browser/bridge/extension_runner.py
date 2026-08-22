"""
ExtensionTaskRunner — True In-Browser Agent Execution for Chrome Extension.

Architecture:
  Extension JS
    → chrome.debugger.attach(tabId)  [uses built-in Chrome Extension API, no port 9222 needed]
    → CDP bridge WebSocket to backend at /ws/cdp-bridge/{task_id}

  Backend
    → CdpBridgeProxy: receives CDP messages from Extension JS, forwards to BrowserSession
    → BrowserSession connects to CdpBridgeProxy as its CDP endpoint
    → Browser Use Agent reasoning runs normally against real DOM
    → Actions execute on the ACTUAL current tab via chrome.debugger

This file MUST NOT call:
  - coordinator.attach_system_chrome()
  - coordinator.create_managed_session()
  - coordinator.active_session_id
  - BrowserProfile(executable_path=...)
  - subprocess.Popen() for any browser
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from deep_browser.events.models import DeepBrowserEvent, EventType

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# ExtensionTaskContext
# A pure UI/task state for one Extension task. NOT a Workspace session.
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExtensionTaskContext:
    """Local state for a single Extension task. Never inserted into coordinator or SessionManager."""
    id: str                          # EXT-<id>
    task_id: str                     # task_<timestamp>
    task: str                        # Original user prompt
    tab_id: Optional[int] = None     # Chrome tab ID
    window_id: Optional[int] = None  # Chrome window ID
    url: Optional[str] = None        # Active tab URL at task creation
    title: Optional[str] = None      # Active tab title at task creation
    model: str = "gemini-3.5-flash-lite"
    status: str = "created"          # created|running|paused|completed|failed|blocked
    created_at: float = field(default_factory=time.time)
    events: List[Dict[str, Any]] = field(default_factory=list)
    cdp_ready: bool = False          # True once chrome.debugger has connected


# ─────────────────────────────────────────────────────────────────────────────
# CdpBridgeProxy
# Sits between Browser Use BrowserSession and the Extension's chrome.debugger bridge.
# Extension JS <-> WebSocket <-> CdpBridgeProxy <-> BrowserSession (as CDP server)
# ─────────────────────────────────────────────────────────────────────────────

class CdpBridgeProxy:
    """
    A proxy that bridges Extension JS (chrome.debugger) → Backend → BrowserSession.
    
    The Extension JS connects via WebSocket and sends/receives CDP protocol messages.
    BrowserSession connects as if this were a normal CDP endpoint.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self._ext_ws = None          # WebSocket connection from Extension JS
        self._session_callbacks: List = []  # Callbacks from BrowserSession side
        self._pending: Dict[int, asyncio.Future] = {}
        self._event_listeners: List = []
        self._connected_event = asyncio.Event()
        self._message_id = 0
        self._session_message_queues: List[asyncio.Queue] = []

    async def wait_for_extension(self, timeout: float = 15.0) -> bool:
        """Wait until Extension JS connects its chrome.debugger bridge."""
        try:
            await asyncio.wait_for(self._connected_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    def set_extension_websocket(self, ws):
        """Called when Extension JS connects its CDP bridge WebSocket."""
        self._ext_ws = ws
        self._connected_event.set()
        logger.info(f"[CdpBridgeProxy:{self.task_id}] Extension CDP bridge connected")

    def add_session_queue(self, queue: asyncio.Queue):
        """BrowserSession registers a queue to receive CDP events."""
        self._session_message_queues.append(queue)

    def remove_session_queue(self, queue: asyncio.Queue):
        if queue in self._session_message_queues:
            self._session_message_queues.remove(queue)

    async def send_to_extension(self, message: dict) -> None:
        """Send a CDP command from BrowserSession to the Extension JS bridge."""
        if self._ext_ws:
            try:
                await self._ext_ws.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"[CdpBridgeProxy:{self.task_id}] Error sending to extension: {e}")

    async def relay_from_extension(self, raw_message: str) -> None:
        """
        Called when Extension JS sends a CDP response/event back.
        Forward to all BrowserSession listeners.
        """
        for queue in self._session_message_queues:
            try:
                await queue.put(raw_message)
            except Exception:
                pass

    @property
    def is_connected(self) -> bool:
        return self._ext_ws is not None and self._connected_event.is_set()


# ─────────────────────────────────────────────────────────────────────────────
# Extension Observation Builder
# Provides initial page context to Browser Use Agent before CDP is active.
# ─────────────────────────────────────────────────────────────────────────────

def build_extension_context_prompt(task: str, ctx: ExtensionTaskContext) -> str:
    """
    Build an initial observation prompt for the Browser Use Agent.
    This ensures 'Kerjakan halaman ini' works immediately on the current tab.
    """
    return f"""[EXTENSION CURRENT TAB CONTEXT]
URL: {ctx.url or 'about:blank'}
Title: {ctx.title or 'Active Tab'}
Tab ID: {ctx.tab_id or 'Current'}
Window ID: {ctx.window_id or 'Current'}

User Task: {task}

CRITICAL EXECUTION INSTRUCTIONS:
- You are operating directly on the user's CURRENT active browser tab via the Deep-Browser Extension.
- The page is ALREADY OPEN at the URL above.
- Do NOT navigate to a search engine. Do NOT open a new tab unless explicitly requested.
- Start by observing the already-open page above and perform the task directly on it.
- "Kerjakan halaman ini" means: work on THIS page that is already open."""


# ─────────────────────────────────────────────────────────────────────────────
# Extension Action Event Mapper
# Maps Browser Use action names to normalized Deep-Browser EventType.
# ─────────────────────────────────────────────────────────────────────────────

ACTION_TO_EVENT_TYPE = {
    "navigate_to": EventType.NAVIGATE,
    "go_to_url": EventType.NAVIGATE,
    "navigate": EventType.NAVIGATE,
    "click_element": EventType.CLICK,
    "click": EventType.CLICK,
    "input_text": EventType.TYPE,
    "type": EventType.TYPE,
    "scroll_page": EventType.SCROLL,
    "scroll": EventType.SCROLL,
    "wait": EventType.WAIT,
    "press_key": EventType.PRESS_KEY,
    "key_press": EventType.PRESS_KEY,
    "switch_tab": EventType.TAB_SWITCH,
}


def map_action_to_event(act_name: str, act_params: Any) -> tuple:
    """Returns (EventType, target_str)."""
    evt_type = ACTION_TO_EVENT_TYPE.get(act_name, EventType.ACTION_REQUESTED)
    target_str = ""
    if isinstance(act_params, dict):
        target_str = (
            act_params.get("url", "")
            or act_params.get("text", "")
            or act_params.get("key", "")
            or f"Element #{act_params.get('index', '')}"
            or str(act_params)
        )
    else:
        target_str = str(act_params) if act_params else ""
    return evt_type, target_str


# ─────────────────────────────────────────────────────────────────────────────
# Registry of active CdpBridgeProxy instances (keyed by task_id)
# ─────────────────────────────────────────────────────────────────────────────

_cdp_bridges: Dict[str, CdpBridgeProxy] = {}


def get_or_create_cdp_bridge(task_id: str) -> CdpBridgeProxy:
    if task_id not in _cdp_bridges:
        _cdp_bridges[task_id] = CdpBridgeProxy(task_id)
    return _cdp_bridges[task_id]


def get_cdp_bridge(task_id: str) -> Optional[CdpBridgeProxy]:
    return _cdp_bridges.get(task_id)


def remove_cdp_bridge(task_id: str) -> None:
    _cdp_bridges.pop(task_id, None)


# ─────────────────────────────────────────────────────────────────────────────
# Registry of active ExtensionTaskContext instances (keyed by session_id)
# COMPLETELY separate from coordinator._sessions / Workspace
# ─────────────────────────────────────────────────────────────────────────────

_extension_tasks: Dict[str, ExtensionTaskContext] = {}


def register_extension_task(ctx: ExtensionTaskContext) -> None:
    _extension_tasks[ctx.id] = ctx


def get_extension_task(session_id: str) -> Optional[ExtensionTaskContext]:
    return _extension_tasks.get(session_id)


def list_extension_tasks() -> List[ExtensionTaskContext]:
    return list(_extension_tasks.values())


def remove_extension_task(session_id: str) -> None:
    _extension_tasks.pop(session_id, None)
