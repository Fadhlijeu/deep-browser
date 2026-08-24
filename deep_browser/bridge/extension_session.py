"""
ExtensionBrowserSession & ExtensionTransport
============================================

True BrowserSession implementation for the Chrome Extension environment.
Acts as the browser engine for standard Browser Use Agent and Tools.

Architecture:
  Browser Use Agent
      ↓
  Tools / SafeTools (Registry)
      ↓ Dispatches standard events (NavigateToUrlEvent, ClickElementEvent, etc.)
  ExtensionBrowserSession (Subclass of BrowserSession)
      ↓ Translates events to atomic commands
  ExtensionTransport (WebSocket Relay)
      ↓ JSON frames over WebSocket
  Chrome Extension (sidepanel.js on active tab)
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple, cast
from uuid_extensions import uuid7str

from bubus import BaseEvent, EventBus
from pydantic import ConfigDict, Field, PrivateAttr

from browser_use.browser.events import (
    BrowserStateRequestEvent,
    ClickCoordinateEvent,
    ClickElementEvent,
    CloseTabEvent,
    GetDropdownOptionsEvent,
    GoBackEvent,
    GoForwardEvent,
    NavigateToUrlEvent,
    RefreshEvent,
    ScrollEvent,
    ScrollToTextEvent,
    SelectDropdownOptionEvent,
    SendKeysEvent,
    SwitchTabEvent,
    TypeTextEvent,
    WaitEvent,
)
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession, ResilientEventBus
from browser_use.browser.views import BrowserStateSummary, PageInfo, TabInfo
from browser_use.dom.views import (
    DOMRect,
    DOMSelectorMap,
    EnhancedDOMTreeNode,
    NodeType,
    SerializedDOMState,
    SimplifiedNode,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Transport Layer: Bidirectional Request-Response over WebSocket
# ─────────────────────────────────────────────────────────────────────────────

class ExtensionTransport:
    """
    Manages transport queues and request-response matching between
    the backend ExtensionBrowserSession and the Chrome Extension JS.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.send_queue: asyncio.Queue = asyncio.Queue()  # backend → extension
        self.recv_queue: asyncio.Queue = asyncio.Queue()  # extension → backend
        self._pending_requests: Dict[str, asyncio.Future] = {}
        self._connected_event = asyncio.Event()
        self._closed = False
        self._pump_task: Optional[asyncio.Task] = None

    def mark_connected(self) -> None:
        """Called when WebSocket handshake is established."""
        self._connected_event.set()
        if not self._pump_task or self._pump_task.done():
            self._pump_task = asyncio.create_task(self._process_incoming())

    async def wait_connected(self, timeout: float = 20.0) -> bool:
        """Wait until Extension connects via WebSocket."""
        try:
            await asyncio.wait_for(self._connected_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def request(self, command: str, params: Optional[Dict[str, Any]] = None, timeout: float = 30.0) -> Dict[str, Any]:
        """
        Send a command to Extension and wait for matched response via request_id.
        """
        if self._closed:
            raise RuntimeError(f"Transport for task {self.task_id} is closed")

        request_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self._pending_requests[request_id] = future

        msg = {
            "type": "TRANSPORT_COMMAND",
            "request_id": request_id,
            "command": command,
            "params": params or {},
        }
        await self.send_queue.put(msg)

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            self._pending_requests.pop(request_id, None)
            raise TimeoutError(f"Extension command '{command}' timed out after {timeout}s (task: {self.task_id})")
        except Exception as e:
            self._pending_requests.pop(request_id, None)
            raise e

    async def push_incoming(self, raw_msg: Dict[str, Any]) -> None:
        """Called by FastAPI WebSocket handler when message arrives from Extension."""
        await self.recv_queue.put(raw_msg)

    async def _process_incoming(self) -> None:
        """Background loop dispatching responses to waiting futures."""
        try:
            while not self._closed:
                msg = await self.recv_queue.get()
                req_id = msg.get("request_id")
                if req_id and req_id in self._pending_requests:
                    future = self._pending_requests.pop(req_id)
                    if not future.done():
                        if msg.get("error"):
                            future.set_exception(RuntimeError(msg["error"]))
                        else:
                            future.set_result(msg.get("result", {}))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[ExtensionTransport:{self.task_id}] Incoming processor error: {e}")

    def close(self) -> None:
        self._closed = True
        if self._pump_task and not self._pump_task.done():
            self._pump_task.cancel()
        for fut in self._pending_requests.values():
            if not fut.done():
                fut.cancel()
        self._pending_requests.clear()


# Global registry of active transport instances
_transports: Dict[str, ExtensionTransport] = {}


def get_or_create_extension_transport(task_id: str) -> ExtensionTransport:
    if task_id not in _transports:
        _transports[task_id] = ExtensionTransport(task_id)
    return _transports[task_id]


def get_extension_transport(task_id: str) -> Optional[ExtensionTransport]:
    return _transports.get(task_id)


def remove_extension_transport(task_id: str) -> None:
    t = _transports.pop(task_id, None)
    if t:
        t.close()


# ─────────────────────────────────────────────────────────────────────────────
# DOM Construction Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_dom_tree_from_elements(
    raw_elements: List[Dict[str, Any]],
    url: str,
    title: str,
) -> Tuple[SimplifiedNode, DOMSelectorMap]:
    """
    Converts raw interactive elements extracted by Extension JS into
    a valid Browser Use SimplifiedNode tree and DOMSelectorMap.
    """
    selector_map: DOMSelectorMap = {}

    root_node = EnhancedDOMTreeNode(
        node_id=0,
        backend_node_id=0,
        node_type=NodeType.ELEMENT_NODE,
        node_name="BODY",
        node_value="",
        attributes={"url": url, "title": title},
        is_scrollable=False,
        is_visible=True,
        absolute_position=None,
        target_id="current_tab",
        frame_id=None,
        session_id=None,
        content_document=None,
        shadow_root_type=None,
        shadow_roots=None,
        parent_node=None,
        children_nodes=None,
        ax_node=None,
        snapshot_node=None,
    )

    root_simplified = SimplifiedNode(
        original_node=root_node,
        children=[],
        should_display=True,
        is_interactive=False,
        selector_index=None,
    )

    for el in raw_elements:
        idx = el.get("index")
        if idx is None:
            continue

        tag = (el.get("tag") or "div").lower()
        text = (el.get("text") or "").strip()
        xpath = el.get("xpath") or ""
        attrs = {
            "type": el.get("type", ""),
            "role": el.get("role", ""),
            "name": el.get("name", ""),
            "placeholder": el.get("placeholder", ""),
            "href": el.get("href", ""),
            "id": el.get("id", ""),
            "value": el.get("value", ""),
        }
        attrs = {k: v for k, v in attrs.items() if v}

        # Create EnhancedDOMTreeNode for selector_map
        node = EnhancedDOMTreeNode(
            node_id=idx,
            backend_node_id=idx,
            node_type=NodeType.ELEMENT_NODE,
            node_name=tag.upper(),
            node_value=text,
            attributes=attrs,
            is_scrollable=False,
            is_visible=True,
            absolute_position=None,
            target_id="current_tab",
            frame_id=None,
            session_id=None,
            content_document=None,
            shadow_root_type=None,
            shadow_roots=None,
            parent_node=root_node,
            children_nodes=None,
            ax_node=None,
            snapshot_node=None,
        )
        selector_map[idx] = node

        # Create SimplifiedNode child for LLM serialization tree
        child_simplified = SimplifiedNode(
            original_node=node,
            children=[],
            should_display=True,
            is_interactive=True,
            selector_index=idx,
        )
        root_simplified.children.append(child_simplified)

    return root_simplified, selector_map



# ─────────────────────────────────────────────────────────────────────────────
# ExtensionBrowserSession: True BrowserSession implementation
# ─────────────────────────────────────────────────────────────────────────────

class ExtensionBrowserSession(BrowserSession):
    """
    Real BrowserSession adapter driving the user's active Chrome tab
    through an ExtensionTransport over WebSocket.

    Fully implements the BrowserSession interface expected by:
      - browser_use.Agent
      - browser_use.tools.Tools
      - deep_browser.policies.SafeTools
    """

    model_config = ConfigDict(arbitrary_types_allowed=True, revalidate_instances="never")

    _transport: ExtensionTransport = PrivateAttr()
    _current_url: str = PrivateAttr(default="about:blank")
    _current_title: str = PrivateAttr(default="Active Tab")
    _current_tab_id: Optional[int] = PrivateAttr(default=None)

    def __init__(
        self,
        transport: ExtensionTransport,
        browser_profile: Optional[BrowserProfile] = None,
        id: Optional[str] = None,
        initial_url: Optional[str] = None,
        initial_title: Optional[str] = None,
        initial_tab_id: Optional[int] = None,
        **kwargs,
    ):
        profile = browser_profile or BrowserProfile(headless=False)
        super().__init__(
            id=id or f"ext_sess_{uuid7str()[-8:]}",
            browser_profile=profile,
            **kwargs,
        )
        self._transport = transport
        self._current_url = initial_url or "about:blank"
        self._current_title = initial_title or "Active Tab"
        self._current_tab_id = initial_tab_id

        # Replace event bus with a fresh ResilientEventBus and wire extension handlers
        self.event_bus = ResilientEventBus(name=f"ExtensionEventBus_{self.id[-8:]}")
        self._setup_extension_event_handlers()

    @property
    def is_cdp_connected(self) -> bool:
        """Always True while the Extension WebSocket is active."""
        return not self._transport._closed

    def _setup_extension_event_handlers(self) -> None:
        """
        Wire event handlers on the event_bus for standard browser events
        dispatched by Tools / SafeTools using standard BaseWatchdog attachment.
        """
        from browser_use.browser.watchdog_base import BaseWatchdog

        BaseWatchdog.attach_handler_to_session(self, NavigateToUrlEvent, self.on_NavigateToUrlEvent)
        BaseWatchdog.attach_handler_to_session(self, ClickElementEvent, self.on_ClickElementEvent)
        BaseWatchdog.attach_handler_to_session(self, ClickCoordinateEvent, self.on_ClickCoordinateEvent)
        BaseWatchdog.attach_handler_to_session(self, TypeTextEvent, self.on_TypeTextEvent)
        BaseWatchdog.attach_handler_to_session(self, ScrollEvent, self.on_ScrollEvent)
        BaseWatchdog.attach_handler_to_session(self, ScrollToTextEvent, self.on_ScrollToTextEvent)
        BaseWatchdog.attach_handler_to_session(self, SendKeysEvent, self.on_SendKeysEvent)
        BaseWatchdog.attach_handler_to_session(self, WaitEvent, self.on_WaitEvent)
        BaseWatchdog.attach_handler_to_session(self, GoBackEvent, self.on_GoBackEvent)
        BaseWatchdog.attach_handler_to_session(self, GoForwardEvent, self.on_GoForwardEvent)
        BaseWatchdog.attach_handler_to_session(self, RefreshEvent, self.on_RefreshEvent)
        BaseWatchdog.attach_handler_to_session(self, SwitchTabEvent, self.on_SwitchTabEvent)
        BaseWatchdog.attach_handler_to_session(self, CloseTabEvent, self.on_CloseTabEvent)
        BaseWatchdog.attach_handler_to_session(self, BrowserStateRequestEvent, self.on_BrowserStateRequestEvent)

    # ─── Event Handlers ───────────────────────────────────────────────────────

    async def on_NavigateToUrlEvent(self, event: NavigateToUrlEvent) -> None:
        logger.info(f"[ExtensionSession] Navigating to {event.url} (new_tab={event.new_tab})")
        res = await self._transport.request("NAVIGATE", {"url": event.url, "new_tab": event.new_tab}, timeout=30.0)
        self._current_url = res.get("url", event.url)
        self._current_title = res.get("title", self._current_title)

    async def on_ClickElementEvent(self, event: ClickElementEvent) -> Dict[str, Any]:
        node = event.node
        idx = node.highlight_index if getattr(node, "highlight_index", None) is not None else node.backend_node_id
        xpath = getattr(node, "x_path", "") or ""
        if not xpath and self._cached_selector_map and idx in self._cached_selector_map:
            xpath = getattr(self._cached_selector_map[idx], "x_path", "") or ""
        logger.info(f"[ExtensionSession] Clicking element [{idx}] (xpath: {xpath})")
        res = await self._transport.request("CLICK", {"index": idx, "xpath": xpath, "button": event.button}, timeout=20.0)
        return res

    async def on_ClickCoordinateEvent(self, event: ClickCoordinateEvent) -> Dict[str, Any]:
        logger.info(f"[ExtensionSession] Clicking coordinate ({event.coordinate_x}, {event.coordinate_y})")
        res = await self._transport.request(
            "CLICK_COORDINATE",
            {"x": event.coordinate_x, "y": event.coordinate_y, "button": event.button},
            timeout=20.0,
        )
        return res

    async def on_TypeTextEvent(self, event: TypeTextEvent) -> Dict[str, Any]:
        node = event.node
        idx = node.highlight_index if getattr(node, "highlight_index", None) is not None else node.backend_node_id
        xpath = getattr(node, "x_path", "") or ""
        if not xpath and self._cached_selector_map and idx in self._cached_selector_map:
            xpath = getattr(self._cached_selector_map[idx], "x_path", "") or ""
        logger.info(f"[ExtensionSession] Typing text into element [{idx}]: '{event.text[:30]}'")
        res = await self._transport.request(
            "TYPE",
            {"index": idx, "xpath": xpath, "text": event.text, "clear": event.clear},
            timeout=20.0,
        )
        return res

    async def on_ScrollEvent(self, event: ScrollEvent) -> None:
        logger.info(f"[ExtensionSession] Scrolling {event.direction} by {event.amount}px")
        await self._transport.request(
            "SCROLL",
            {"direction": event.direction, "amount": event.amount},
            timeout=10.0,
        )

    async def on_ScrollToTextEvent(self, event: ScrollToTextEvent) -> None:
        logger.info(f"[ExtensionSession] Scrolling to text: '{event.text}'")
        await self._transport.request(
            "SCROLL_TO_TEXT",
            {"text": event.text, "direction": event.direction},
            timeout=15.0,
        )

    async def on_SendKeysEvent(self, event: SendKeysEvent) -> None:
        logger.info(f"[ExtensionSession] Sending keys: '{event.keys}'")
        await self._transport.request("SEND_KEYS", {"keys": event.keys}, timeout=10.0)

    async def on_WaitEvent(self, event: WaitEvent) -> None:
        wait_time = min(event.seconds, event.max_seconds)
        logger.info(f"[ExtensionSession] Waiting {wait_time}s")
        await asyncio.sleep(wait_time)

    async def on_GoBackEvent(self, event: GoBackEvent) -> None:
        logger.info("[ExtensionSession] Navigating back")
        res = await self._transport.request("GO_BACK", {}, timeout=15.0)
        self._current_url = res.get("url", self._current_url)

    async def on_GoForwardEvent(self, event: GoForwardEvent) -> None:
        logger.info("[ExtensionSession] Navigating forward")
        res = await self._transport.request("GO_FORWARD", {}, timeout=15.0)
        self._current_url = res.get("url", self._current_url)

    async def on_RefreshEvent(self, event: RefreshEvent) -> None:
        logger.info("[ExtensionSession] Refreshing page")
        res = await self._transport.request("REFRESH", {}, timeout=20.0)
        self._current_url = res.get("url", self._current_url)

    async def on_SwitchTabEvent(self, event: SwitchTabEvent) -> str:
        logger.info(f"[ExtensionSession] Switching tab: {event.target_id}")
        res = await self._transport.request("SWITCH_TAB", {"target_id": event.target_id}, timeout=15.0)
        return str(res.get("tab_id", event.target_id or "current"))

    async def on_CloseTabEvent(self, event: CloseTabEvent) -> None:
        logger.info(f"[ExtensionSession] Closing tab: {event.target_id}")
        await self._transport.request("CLOSE_TAB", {"target_id": event.target_id}, timeout=15.0)

    async def on_BrowserStateRequestEvent(self, event: BrowserStateRequestEvent) -> BrowserStateSummary:
        return await self.get_browser_state_summary(
            include_screenshot=event.include_screenshot,
            include_recent_events=event.include_recent_events,
        )


    # ─── State Capture: get_browser_state_summary ─────────────────────────────

    async def get_browser_state_summary(
        self,
        include_screenshot: bool = True,
        cached: bool = False,
        include_recent_events: bool = False,
    ) -> BrowserStateSummary:
        """
        Requests current DOM snapshot and screenshot from Chrome Extension,
        and constructs an authentic BrowserStateSummary with SerializedDOMState.
        """
        logger.debug(f"[ExtensionSession] Requesting state from Chrome (screenshot={include_screenshot})")

        try:
            raw_state = await self._transport.request(
                "GET_STATE",
                {"include_screenshot": include_screenshot},
                timeout=25.0,
            )
        except Exception as e:
            logger.error(f"[ExtensionSession] Failed to capture state from Extension: {e}")
            empty_dom = SerializedDOMState(_root=None, selector_map={})
            return BrowserStateSummary(
                dom_state=empty_dom,
                url=self._current_url,
                title=self._current_title,
                tabs=[TabInfo(url=self._current_url, title=self._current_title, target_id=str(self._current_tab_id or "0"))],
                screenshot=None,
                state_error=f"Failed to capture browser state: {e}",
            )

        url = raw_state.get("url") or self._current_url
        title = raw_state.get("title") or self._current_title
        screenshot_b64 = raw_state.get("screenshot") if include_screenshot else None
        raw_elements = raw_state.get("elements") or []
        tabs_raw = raw_state.get("tabs") or [{"url": url, "title": title, "id": self._current_tab_id or 0}]

        self._current_url = url
        self._current_title = title

        # Build SimplifiedNode tree and DOMSelectorMap
        root_node, selector_map = _build_dom_tree_from_elements(raw_elements, url, title)
        dom_state = SerializedDOMState(_root=root_node, selector_map=selector_map)

        # Update cache so get_element_by_index() resolves correctly during Tools.act()
        self.update_cached_selector_map(selector_map)

        # Build tabs list
        tabs: List[TabInfo] = []
        for t in tabs_raw:
            tabs.append(
                TabInfo(
                    url=t.get("url") or url,
                    title=t.get("title") or title,
                    target_id=str(t.get("id", "current")),
                )
            )

        # Build page info
        page_info_raw = raw_state.get("page_info") or {}
        page_info = PageInfo(
            viewport_width=page_info_raw.get("viewport_width", 1280),
            viewport_height=page_info_raw.get("viewport_height", 800),
            page_width=page_info_raw.get("page_width", 1280),
            page_height=page_info_raw.get("page_height", 2400),
            scroll_x=page_info_raw.get("scroll_x", 0),
            scroll_y=page_info_raw.get("scroll_y", 0),
            pixels_above=page_info_raw.get("pixels_above", 0),
            pixels_below=page_info_raw.get("pixels_below", 0),
            pixels_left=0,
            pixels_right=0,
        )

        summary = BrowserStateSummary(
            dom_state=dom_state,
            url=url,
            title=title,
            tabs=tabs,
            screenshot=screenshot_b64,
            page_info=page_info,
            pixels_above=page_info.pixels_above,
            pixels_below=page_info.pixels_below,
        )

        self._cached_browser_state_summary = summary
        return summary

    # ─── Query Helpers & Media Capture ────────────────────────────────────────

    async def get_element_by_index(self, index: int) -> Optional[EnhancedDOMTreeNode]:
        """Resolves element by its highlight/backend index from cached selector map."""
        if not self._cached_selector_map:
            return None
        return self._cached_selector_map.get(index)

    async def get_tabs(self) -> List[TabInfo]:
        """Returns the list of open tabs."""
        if self._cached_browser_state_summary and self._cached_browser_state_summary.tabs:
            return self._cached_browser_state_summary.tabs
        return [TabInfo(url=self._current_url, title=self._current_title, target_id=str(self._current_tab_id or "0"))]

    async def get_title(self) -> str:
        """Returns current page title."""
        return self._current_title or "Active Tab"

    async def get_url(self) -> str:
        """Returns current page URL."""
        return self._current_url or "about:blank"

    async def take_screenshot(
        self,
        path: Optional[str] = None,
        full_page: bool = False,
        format: str = "png",
        quality: Optional[int] = None,
        clip: Optional[dict] = None,
    ) -> bytes:
        """
        Captures a high-resolution screenshot from the active Chrome tab via Extension transport.
        Saves to path if provided and broadcasts SCREENSHOT_CAPTURED to the chat UI.
        """
        import base64
        from pathlib import Path
        from deep_browser.events import EventBroadcaster, DeepBrowserEvent, EventType

        logger.info(f"[ExtensionSession] Capturing screenshot (full_page={full_page}, format={format})")

        b64_data = None
        try:
            res = await self._transport.request(
                "TAKE_SCREENSHOT",
                {"full_page": full_page, "format": format, "quality": quality, "clip": clip},
                timeout=20.0,
            )
            b64_data = res.get("screenshot")
        except Exception as e:
            logger.warning(f"[ExtensionSession] TAKE_SCREENSHOT command error: {e}, falling back to GET_STATE")

        if not b64_data:
            try:
                state_res = await self._transport.request("GET_STATE", {"include_screenshot": True}, timeout=20.0)
                b64_data = state_res.get("screenshot")
            except Exception as e:
                logger.error(f"[ExtensionSession] Failed to capture fallback screenshot: {e}")

        img_bytes = base64.b64decode(b64_data) if b64_data else b""

        if path and img_bytes:
            try:
                file_path = Path(path)
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(img_bytes)
            except Exception as e:
                logger.error(f"[ExtensionSession] Failed to save screenshot file to {path}: {e}")

        # Broadcast SCREENSHOT_CAPTURED to Extension chat UI for rich presentation
        if b64_data:
            data_url = f"data:image/{format};base64,{b64_data}"
            file_name = Path(path).name if path else f"screenshot_{int(time.time())}.png"
            try:
                task_id = getattr(self._transport, "task_id", "active")
                asyncio.create_task(
                    EventBroadcaster.get_instance().broadcast(
                        DeepBrowserEvent(
                            task_id=task_id,
                            session_id=self.id,
                            event_type=EventType.SCREENSHOT_CAPTURED,
                            message="Screenshot captured",
                            data={"screenshotDataUrl": data_url, "fileName": file_name},
                        )
                    )
                )
            except Exception:
                pass

        return img_bytes

    async def close(self) -> None:
        """Stops the session."""
        self._transport.close()

