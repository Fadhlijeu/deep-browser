"""
Browser process lifecycle management and Attached/Managed session discovery.
"""

import asyncio
import logging
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
import httpx
from deep_browser.browser.session import BrowserSession
from deep_browser.config import settings

logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages browser processes and active sessions."""

    def __init__(self):
        self._sessions: Dict[str, BrowserSession] = {}
        self._managed_processes: Dict[str, subprocess.Popen] = {}

    async def get_or_create_session(
        self,
        session_id: str,
        profile_id: str = "default",
        mode: Optional[str] = None,
    ) -> BrowserSession:
        """Retrieve existing session or provision a new one."""
        if session_id in self._sessions:
            return self._sessions[session_id]

        target_mode = mode or settings.default_browser_mode

        if target_mode == "attached":
            session = await self._attach_to_existing_chrome(session_id, profile_id)
        else:
            session = await self._launch_managed_browser(session_id, profile_id)

        self._sessions[session_id] = session
        return session

    async def _attach_to_existing_chrome(self, session_id: str, profile_id: str) -> BrowserSession:
        """Connect to an existing Chrome instance with remote debugging enabled."""
        port = settings.attached_cdp_port
        discovery_url = f"http://127.0.0.1:{port}/json"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(discovery_url)
                tabs = res.json()
        except Exception as e:
            raise ConnectionError(
                f"Could not connect to Chrome on port {port}. Please ensure Chrome was started with "
                f"`--remote-debugging-port={port}`. Details: {e}"
            )

        # Select the first page tab
        page_tabs = [t for t in tabs if t.get("type") == "page"]
        if not page_tabs:
            raise RuntimeError("No open web pages found in the attached Chrome instance")

        target_tab = page_tabs[0]
        ws_url = target_tab.get("webSocketDebuggerUrl")
        if not ws_url:
            raise RuntimeError("Attached Chrome tab did not provide a webSocketDebuggerUrl")

        session = BrowserSession(
            session_id=session_id,
            profile_id=profile_id,
            mode="attached",
            cdp_ws_url=ws_url,
            target_id=target_tab.get("id"),
        )
        await session.initialize()
        return session

    async def _launch_managed_browser(self, session_id: str, profile_id: str) -> BrowserSession:
        """Spawn a managed Chromium subprocess with isolated user data dir."""
        # Allocate dynamic port for multi-browser support
        port = 9222 + (len(self._managed_processes) + 1)
        profile_dir = settings.workspace_dir / "sessions" / profile_id
        profile_dir.mkdir(parents=True, exist_ok=True)

        chrome_candidates = [
            # Windows defaults
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            # Edge fallback on Windows
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            # Unix / macOS
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ]

        binary_path = None
        for candidate in chrome_candidates:
            if candidate and Path(candidate).exists():
                binary_path = candidate
                break

        if not binary_path:
            raise FileNotFoundError(
                "Could not locate a local Chrome or Chromium binary. Please install Google Chrome or Microsoft Edge."
            )

        args = [
            binary_path,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={str(profile_dir)}",
            f"--window-size={settings.managed_viewport_width},{settings.managed_viewport_height}",
            "--no-first-run",
            "--no-default-browser-check",
            "about:blank",
        ]

        if settings.managed_headless:
            args.append("--headless=new")

        logger.info(f"Launching managed browser PID on port {port}: {' '.join(args)}")
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self._managed_processes[session_id] = proc

        # Wait for CDP discovery endpoint to come online
        discovery_url = f"http://127.0.0.1:{port}/json"
        ws_url = None
        for _ in range(30):
            await asyncio.sleep(0.2)
            try:
                async with httpx.AsyncClient(timeout=1.0) as client:
                    res = await client.get(discovery_url)
                    tabs = res.json()
                    page_tabs = [t for t in tabs if t.get("type") == "page"]
                    if page_tabs:
                        ws_url = page_tabs[0].get("webSocketDebuggerUrl")
                        target_id = page_tabs[0].get("id")
                        break
            except Exception:
                continue

        if not ws_url:
            proc.kill()
            raise TimeoutError(f"Managed browser on port {port} failed to initialize CDP endpoint")

        session = BrowserSession(
            session_id=session_id,
            profile_id=profile_id,
            mode="managed",
            cdp_ws_url=ws_url,
            target_id=target_id,
        )
        await session.initialize()
        return session

    async def close_session(self, session_id: str) -> None:
        """Close an active session and terminate managed process if applicable."""
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()

        proc = self._managed_processes.pop(session_id, None)
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                proc.kill()

    async def list_active_sessions(self) -> List[Dict[str, Any]]:
        """List active browser sessions with details."""
        result = []
        for sid, s in self._sessions.items():
            result.append(
                {
                    "session_id": sid,
                    "profile_id": s.profile_id,
                    "mode": s.mode,
                    "url": s.current_url,
                    "title": s.current_title,
                }
            )
        return result


browser_manager = BrowserManager()
