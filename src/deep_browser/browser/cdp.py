"""
Direct Chrome DevTools Protocol (CDP) WebSocket client.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, Optional
import websockets

logger = logging.getLogger(__name__)


class CDPClient:
    """Lightweight async CDP WebSocket client."""

    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws: Optional[Any] = None
        self._message_id = 0
        self._pending_requests: Dict[int, asyncio.Future] = {}
        self._event_listeners: Dict[str, list[Callable[[Dict[str, Any]], None]]] = {}
        self._receiver_task: Optional[asyncio.Task] = None
        self._is_connected = False

    async def connect(self, timeout: float = 10.0) -> None:
        """Establish WebSocket connection to CDP target."""
        if self._is_connected and self.ws:
            return

        logger.info(f"Connecting CDP client to {self.ws_url}")
        self.ws = await asyncio.wait_for(websockets.connect(self.ws_url, max_size=100_000_000), timeout=timeout)
        self._is_connected = True
        self._receiver_task = asyncio.create_task(self._receive_loop())

    async def disconnect(self) -> None:
        """Close connection and cancel listener loops."""
        self._is_connected = False
        if self._receiver_task:
            self._receiver_task.cancel()
            try:
                await self._receiver_task
            except asyncio.CancelledError:
                pass
        if self.ws:
            await self.ws.close()
            self.ws = None

    async def send_command(self, method: str, params: Optional[Dict[str, Any]] = None, timeout: float = 15.0) -> Dict[str, Any]:
        """Send a CDP command and await response."""
        if not self.ws or not self._is_connected:
            raise ConnectionError("CDP client is not connected")

        self._message_id += 1
        msg_id = self._message_id
        payload = {"id": msg_id, "method": method, "params": params or {}}

        future = asyncio.get_event_loop().create_future()
        self._pending_requests[msg_id] = future

        await self.ws.send(json.dumps(payload))

        try:
            res = await asyncio.wait_for(future, timeout=timeout)
            if "error" in res:
                error_info = res["error"]
                raise RuntimeError(f"CDP Command '{method}' failed: {error_info.get('message', 'Unknown CDP error')}")
            return res.get("result", {})
        finally:
            self._pending_requests.pop(msg_id, None)

    def on_event(self, event_name: str, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register an event listener for CDP notifications."""
        if event_name not in self._event_listeners:
            self._event_listeners[event_name] = []
        self._event_listeners[event_name].append(callback)

    async def _receive_loop(self) -> None:
        """Listen for incoming CDP messages and dispatch responses/events."""
        try:
            while self._is_connected and self.ws:
                raw_msg = await self.ws.recv()
                msg = json.loads(raw_msg)

                if "id" in msg:
                    msg_id = msg["id"]
                    if msg_id in self._pending_requests:
                        future = self._pending_requests[msg_id]
                        if not future.done():
                            future.set_result(msg)
                elif "method" in msg:
                    method = msg["method"]
                    params = msg.get("params", {})
                    if method in self._event_listeners:
                        for cb in self._event_listeners[method]:
                            try:
                                if asyncio.iscoroutinefunction(cb):
                                    asyncio.create_task(cb(params))
                                else:
                                    cb(params)
                            except Exception as e:
                                logger.error(f"Error in CDP event listener for {method}: {e}")
        except websockets.exceptions.ConnectionClosed:
            logger.warning("CDP connection closed by remote target")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"CDP receive loop exception: {e}")
        finally:
            self._is_connected = False
