"""
Event broadcaster for real-time telemetry streaming to WebSockets and extension.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Set
from deep_browser.events.models import DeepBrowserEvent

logger = logging.getLogger(__name__)


class EventBroadcaster:
    _instance: "EventBroadcaster | None" = None

    def __init__(self):
        self._listeners: Set[Callable[[DeepBrowserEvent], Any]] = set()
        self._async_listeners: Set[Callable[[DeepBrowserEvent], asyncio.Future]] = set()
        self._history: list[DeepBrowserEvent] = []

    @classmethod
    def get_instance(cls) -> "EventBroadcaster":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def subscribe(self, callback: Callable[[DeepBrowserEvent], Any]) -> None:
        self._listeners.add(callback)

    def unsubscribe(self, callback: Callable[[DeepBrowserEvent], Any]) -> None:
        self._listeners.discard(callback)

    def subscribe_async(self, callback: Callable[[DeepBrowserEvent], asyncio.Future]) -> None:
        self._async_listeners.add(callback)

    def unsubscribe_async(self, callback: Callable[[DeepBrowserEvent], asyncio.Future]) -> None:
        self._async_listeners.discard(callback)

    async def broadcast(self, event: DeepBrowserEvent) -> None:
        self._history.append(event)
        if len(self._history) > 1000:
            self._history.pop(0)

        for listener in list(self._listeners):
            try:
                res = listener(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.error(f"Error in sync event listener: {e}")

        for async_listener in list(self._async_listeners):
            try:
                res = async_listener(event)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.error(f"Error in async event listener: {e}")

    async def register_client(self) -> asyncio.Queue:
        """Creates a client subscription queue for real-time WebSocket event streaming."""
        queue: asyncio.Queue = asyncio.Queue()

        async def _listener(event: DeepBrowserEvent):
            try:
                await queue.put(event)
            except Exception:
                pass

        self._async_listeners.add(_listener)
        setattr(queue, "_listener_cb", _listener)
        return queue

    async def unregister_client(self, queue: asyncio.Queue) -> None:
        """Unregisters a client subscription queue."""
        cb = getattr(queue, "_listener_cb", None)
        if cb and cb in self._async_listeners:
            self._async_listeners.discard(cb)

    def get_history(self, task_id: str | None = None) -> list[DeepBrowserEvent]:
        if task_id:
            return [e for e in self._history if e.task_id == task_id]
        return list(self._history)
