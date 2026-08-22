"""
Multi-browser session coordinator wrapping Browser Use BrowserSession & BrowserProfile.
Supports Attached Mode (existing Chrome CDP port 9222) and Managed Mode (isolated profile instances).
"""

import logging
from typing import Dict, Optional
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession
from browser_use.browser.session_manager import SessionManager

logger = logging.getLogger(__name__)


class MultiBrowserCoordinator:
    def __init__(self):
        self._session_manager = SessionManager()
        self._active_sessions: Dict[str, BrowserSession] = {}

    async def create_session(
        self,
        session_id: str,
        attached_mode: bool = False,
        cdp_port: int = 9222,
        headless: bool = False,
        user_data_dir: Optional[str] = None,
    ) -> BrowserSession:
        """Creates or attaches a BrowserSession."""
        if attached_mode:
            logger.info(f"Connecting to attached Chrome on CDP port {cdp_port}")
            profile = BrowserProfile(
                headless=False,
                cdp_url=f"http://localhost:{cdp_port}",
            )
        else:
            logger.info(f"Creating managed Chromium session {session_id} (headless={headless})")
            profile = BrowserProfile(
                headless=headless,
                user_data_dir=user_data_dir,
            )

        session = BrowserSession(browser_profile=profile)
        self._active_sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[BrowserSession]:
        return self._active_sessions.get(session_id)

    async def close_session(self, session_id: str) -> None:
        session = self._active_sessions.pop(session_id, None)
        if session:
            try:
                await session.stop()
            except Exception as e:
                logger.error(f"Error stopping session {session_id}: {e}")

    def list_active_sessions(self) -> Dict[str, Dict[str, Any]]:
        return {
            sid: {
                "id": sid,
                "headless": sess.browser_profile.headless if sess.browser_profile else False,
                "is_attached": bool(sess.browser_profile and sess.browser_profile.cdp_url),
            }
            for sid, sess in self._active_sessions.items()
        }
