"""
Multi-browser session coordinator wrapping Browser Use BrowserSession & BrowserProfile.
Provides real BrowserSession management, Attached Mode vs Managed Mode, and session switching.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from browser_use import BrowserProfile, BrowserSession

logger = logging.getLogger(__name__)


class SessionViewModel(BaseModel):
    """Client-facing representation of an active Browser Use session."""
    id: str
    name: str
    browser_session_id: str
    mode: Literal["attached", "managed"]
    status: Literal["connected", "connecting", "disconnected", "error"]
    owner: Literal["WORKSPACE", "EXTENSION"] = "EXTENSION"
    origin: Literal["WORKSPACE", "EXTENSION"] = "EXTENSION"
    origin_session_id: Optional[str] = None
    handoff_state: Literal["ACTIVE", "HANDOFF_REQUESTED", "HANDED_OFF", "CANCELLED", "FAILED"] = "ACTIVE"
    tag: Optional[str] = None
    active_url: Optional[str] = None
    page_title: Optional[str] = None
    tab_count: int = 1
    is_active: bool = False
    error_message: Optional[str] = None
    created_at: float = Field(default_factory=time.time)


class SessionCoordinator:
    """Singleton coordinator managing real Browser Use BrowserSession instances."""

    _instance: Optional["SessionCoordinator"] = None

    def __init__(self):
        self._sessions: Dict[str, BrowserSession] = {}
        self._session_metadata: Dict[str, Dict[str, Any]] = {}
        self._active_session_id: Optional[str] = None
        self._active_agent: Optional[Any] = None
        self._active_task_id: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "SessionCoordinator":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def clear(self) -> None:
        """Reset coordinator state (for testing)."""
        self._sessions.clear()
        self._session_metadata.clear()
        self._active_session_id = None
        self._active_agent = None
        self._active_task_id = None

    @property
    def active_session_id(self) -> Optional[str]:
        return self._active_session_id

    def get_active_session(self) -> Optional[BrowserSession]:
        if self._active_session_id:
            return self._sessions.get(self._active_session_id)
        return None

    def get_session(self, session_id: str) -> Optional[BrowserSession]:
        return self._sessions.get(session_id)

    async def attach_system_chrome(
        self,
        session_id: Optional[str] = None,
        name: Optional[str] = None,
        cdp_port: int = 9222,
        cdp_url: Optional[str] = None,
        browser_type: str = "chrome",
        owner: Literal["WORKSPACE", "EXTENSION"] = "EXTENSION",
    ) -> SessionViewModel:
        """Connect to an existing user browser (Chrome/Edge/Brave) running with --remote-debugging-port, auto-launching if needed."""
        import uuid
        import subprocess
        import httpx
        from browser_use.browser.chrome import find_browser_executable

        browser_label = "Microsoft Edge" if browser_type in ("edge", "msedge") else "Brave" if browser_type == "brave" else "Google Chrome"
        session_name = name or f"{browser_label} (Attached)"
        target_cdp = cdp_url or f"http://127.0.0.1:{cdp_port}"
        target_sid = session_id or (f"EXT-{uuid.uuid4().hex[:6]}" if owner == "EXTENSION" else f"WS-{uuid.uuid4().hex[:6]}")

        # 1. Probe if CDP endpoint is already reachable
        is_running = False
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                res = await client.get(f"{target_cdp}/json/version")
                if res.status_code == 200:
                    is_running = True
        except Exception:
            is_running = False

        # 2. If not reachable and Workspace mode, auto-launch browser with --remote-debugging-port
        if not is_running and owner == "WORKSPACE":
            bin_path = find_browser_executable(browser_type)
            if bin_path:
                try:
                    logger.info(f"Auto-launching {browser_label} with --remote-debugging-port={cdp_port} from {bin_path}")
                    subprocess.Popen([bin_path, f"--remote-debugging-port={cdp_port}"])
                    await asyncio.sleep(2.0)
                except Exception as e:
                    logger.warning(f"Could not auto-launch browser executable: {e}")

        # 3. Create BrowserProfile and BrowserSession
        status = "connecting"
        error_msg = None
        profile = BrowserProfile(
            headless=False,
            cdp_url=target_cdp,
        )
        session = BrowserSession(browser_profile=profile)

        try:
            await session.start()
            status = "connected"
        except Exception as e:
            if owner == "EXTENSION":
                logger.error(f"CDP connection failed for Extension: {e}")
                status = "error"
                error_msg = f"Connection failed to {browser_label} on port {cdp_port}. Please launch {browser_label} with '--remote-debugging-port={cdp_port}'."
            else:
                logger.warning(f"Initial CDP connection probe failed: {e}. Falling back to clean managed instance for {browser_label}...")
                bin_path = find_browser_executable(browser_type)
                profile = BrowserProfile(
                    headless=False,
                    executable_path=bin_path,
                )
                session = BrowserSession(browser_profile=profile)
                try:
                    await session.start()
                    status = "connected"
                except Exception as e2:
                    logger.error(f"Fallback browser launch failed: {e2}")
                    status = "error"
                    error_msg = str(e2)

        self._sessions[target_sid] = session
        self._session_metadata[target_sid] = {
            "name": session_name,
            "mode": "attached",
            "status": status,
            "owner": owner,
            "origin": owner,
            "origin_session_id": None,
            "handoff_state": "ACTIVE",
            "tag": None,
            "error_message": error_msg,
        }

        # ONLY update global active session if Workspace
        if owner == "WORKSPACE" and not self._active_session_id:
            self._active_session_id = target_sid

        return await self.get_session_view(target_sid)

    async def create_managed_session(
        self,
        name: Optional[str] = None,
        headless: bool = False,
        user_data_dir: Optional[str] = None,
        profile_directory: Optional[str] = None,
        owner: Literal["WORKSPACE", "EXTENSION"] = "WORKSPACE",
    ) -> SessionViewModel:
        """Create a dedicated, managed BrowserSession with isolated user data."""
        import uuid

        session_id = f"WS-M_{uuid.uuid4().hex[:6]}"
        session_name = name or f"Managed Session #{len(self._sessions) + 1}"

        profile = BrowserProfile(
            headless=headless,
            user_data_dir=user_data_dir,
            profile_directory=profile_directory,
        )
        session = BrowserSession(browser_profile=profile)

        status = "connecting"
        error_msg = None
        try:
            await session.start()
            status = "connected"
        except Exception as e:
            logger.error(f"Error starting managed session {session_id}: {e}", exc_info=True)
            status = "error"
            error_msg = str(e)

        self._sessions[session_id] = session
        self._session_metadata[session_id] = {
            "name": session_name,
            "mode": "managed",
            "status": status,
            "owner": owner,
            "origin": owner,
            "origin_session_id": None,
            "handoff_state": "ACTIVE",
            "tag": None,
            "error_message": error_msg,
        }

        if owner == "WORKSPACE" and not self._active_session_id:
            self._active_session_id = session_id

        return await self.get_session_view(session_id)

    def register_existing_session(
        self,
        session: BrowserSession,
        name: str = "Default Session",
        mode: Literal["attached", "managed"] = "managed",
        owner: Literal["WORKSPACE", "EXTENSION"] = "WORKSPACE",
    ) -> str:
        """Register an already created BrowserSession."""
        session_id = session.id or (f"EXT-{int(time.time() * 1000) % 10000:04d}" if owner == "EXTENSION" else f"WS-{int(time.time() * 1000) % 10000:04d}")
        self._sessions[session_id] = session
        self._session_metadata[session_id] = {
            "name": name,
            "mode": mode,
            "status": "connected" if session.is_cdp_connected else "disconnected",
            "owner": owner,
            "origin": owner,
            "origin_session_id": None,
            "handoff_state": "ACTIVE",
            "tag": None,
            "error_message": None,
        }
        if owner == "WORKSPACE" and not self._active_session_id:
            self._active_session_id = session_id
        return session_id

    def handoff_session(
        self,
        session_id: str,
        to_owner: Literal["WORKSPACE", "EXTENSION"] = "WORKSPACE",
    ) -> Optional[SessionViewModel]:
        """Explicitly hand off a session (e.g. Extension -> Workspace)."""
        if session_id not in self._session_metadata:
            return None
        meta = self._session_metadata[session_id]
        meta["owner"] = to_owner
        meta["origin"] = "EXTENSION" if to_owner == "WORKSPACE" else "WORKSPACE"
        meta["origin_session_id"] = session_id
        meta["handoff_state"] = "HANDED_OFF"
        meta["tag"] = "ext" if to_owner == "WORKSPACE" else None
        return self._build_view_sync(session_id)

    def _build_view_sync(self, session_id: str) -> Optional[SessionViewModel]:
        session = self._sessions.get(session_id)
        if not session:
            return None
        meta = self._session_metadata.get(session_id, {})
        return SessionViewModel(
            id=session_id,
            name=meta.get("name", "Browser Session"),
            browser_session_id=session.id or session_id,
            mode=meta.get("mode", "managed"),
            status=meta.get("status", "connected" if session.is_cdp_connected else "disconnected"),
            owner=meta.get("owner", "EXTENSION"),
            origin=meta.get("origin", "EXTENSION"),
            origin_session_id=meta.get("origin_session_id"),
            handoff_state=meta.get("handoff_state", "ACTIVE"),
            tag=meta.get("tag"),
            active_url=None,
            page_title=None,
            tab_count=1,
            is_active=(session_id == self._active_session_id),
            error_message=meta.get("error_message"),
        )

    def switch_active_session(self, session_id: str) -> bool:
        """Switch the active session context for incoming tasks."""
        if session_id in self._sessions:
            self._active_session_id = session_id
            return True
        return False

    def set_active_session(self, session_id: str) -> bool:
        """Alias for switch_active_session."""
        return self.switch_active_session(session_id)

    async def close_session(self, session_id: str) -> bool:
        """Terminate and clean up a BrowserSession."""
        session = self._sessions.pop(session_id, None)
        self._session_metadata.pop(session_id, None)

        if session:
            try:
                await session.kill()
            except Exception as e:
                logger.error(f"Error killing session {session_id}: {e}")

        if self._active_session_id == session_id:
            self._active_session_id = next(iter(self._sessions.keys())) if self._sessions else None

        return True

    async def get_session_view(self, session_id: str) -> Optional[SessionViewModel]:
        """Build the client view model for a specific session."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        meta = self._session_metadata.get(session_id, {})
        status = meta.get("status", "disconnected")
        error_msg = meta.get("error_message")

        # Update status based on real liveness
        if session.is_cdp_connected:
            status = "connected"
        elif status == "connected":
            status = "disconnected"

        active_url = None
        page_title = None
        tab_count = 1

        if session.is_cdp_connected:
            try:
                active_url = await session.get_current_page_url()
                page_title = await session.get_current_page_title()
                tabs = await session.get_tabs()
                tab_count = len(tabs) if tabs else 1
            except Exception:
                pass

        return SessionViewModel(
            id=session_id,
            name=meta.get("name", "Browser Session"),
            browser_session_id=session.id or session_id,
            mode=meta.get("mode", "managed"),
            status=status,
            owner=meta.get("owner", "EXTENSION"),
            origin=meta.get("origin", "EXTENSION"),
            origin_session_id=meta.get("origin_session_id"),
            handoff_state=meta.get("handoff_state", "ACTIVE"),
            tag=meta.get("tag"),
            active_url=active_url,
            page_title=page_title,
            tab_count=tab_count,
            is_active=(session_id == self._active_session_id),
            error_message=error_msg,
        )

    async def list_session_views(self, owner: Optional[str] = None) -> List[SessionViewModel]:
        """List tracked sessions, optionally filtered by owner."""
        views = []
        for sid in list(self._sessions.keys()):
            meta = self._session_metadata.get(sid, {})
            if owner and meta.get("owner") != owner:
                continue
            view = await self.get_session_view(sid)
            if view:
                views.append(view)
        return views

    # Agent Lifecycle Management
    def set_active_agent(self, agent: Any, task_id: str) -> None:
        self._active_agent = agent
        self._active_task_id = task_id

    def get_active_agent(self) -> Optional[Any]:
        return self._active_agent

    def pause_active_agent(self) -> bool:
        """Trigger Browser Use's native Agent.pause()."""
        if self._active_agent and hasattr(self._active_agent, "pause"):
            self._active_agent.pause()
            return True
        return False

    def resume_active_agent(self) -> bool:
        """Trigger Browser Use's native Agent.resume()."""
        if self._active_agent and hasattr(self._active_agent, "resume"):
            self._active_agent.resume()
            return True
        return False

    def stop_active_agent(self) -> bool:
        """Trigger Browser Use's native Agent.stop()."""
        if self._active_agent and hasattr(self._active_agent, "stop"):
            self._active_agent.stop()
            return True
        return False

    async def get_browser_state(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Retrieve live browser URL, title, tabs, and optional screenshot."""
        target_id = session_id or self._active_session_id
        session = self._sessions.get(target_id) if target_id else None

        if not session or not session.is_cdp_connected:
            return {
                "connected": False,
                "url": None,
                "title": None,
                "tabs": [],
                "session_id": target_id,
            }

        url = None
        title = None
        tabs = []
        screenshot = None

        try:
            url = await session.get_current_page_url()
            title = await session.get_current_page_title()
            raw_tabs = await session.get_tabs()
            tabs = [
                {
                    "target_id": getattr(t, "target_id", ""),
                    "url": getattr(t, "url", ""),
                    "title": getattr(t, "title", ""),
                }
                for t in (raw_tabs or [])
            ]
        except Exception as e:
            logger.warning(f"Error fetching state for session {target_id}: {e}")

        return {
            "connected": True,
            "session_id": target_id,
            "url": url,
            "title": title,
            "tabs": tabs,
            "tab_count": len(tabs),
        }


# Backward compatibility alias
MultiBrowserCoordinator = SessionCoordinator

