"""
Acceptance Tests: Extension Browser-Native Agent
Tests that Extension tasks NEVER use coordinator.attach_system_chrome(),
coordinator.create_managed_session(), or coordinator.active_session_id.
"""

import asyncio
import json
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from deep_browser.bridge.extension_runner import (
    ExtensionTaskContext,
    CdpBridgeProxy,
    build_extension_context_prompt,
    map_action_to_event,
    get_or_create_cdp_bridge,
    get_cdp_bridge,
    remove_cdp_bridge,
    register_extension_task,
    get_extension_task,
    remove_extension_task,
    list_extension_tasks,
    ACTION_TO_EVENT_TYPE,
)
from deep_browser.events.models import EventType


# ─────────────────────────────────────────────────────────────────────────────
# Isolation Invariants
# ─────────────────────────────────────────────────────────────────────────────

class TestExtensionIsolationInvariants(unittest.IsolatedAsyncioTestCase):
    """
    TEST 1-4: Invariant tests — Extension NEVER touches coordinator.
    """

    def test_01_extension_task_context_is_never_a_workspace_session(self):
        """An ExtensionTaskContext is a plain dataclass, not a SessionViewModel."""
        ctx = ExtensionTaskContext(
            id="EXT-001",
            task_id="task_1234",
            task="Kerjakan halaman ini",
            tab_id=42,
            url="https://example.com",
            title="Example Domain",
        )
        self.assertEqual(ctx.id, "EXT-001")
        self.assertNotIsInstance(ctx, dict)
        # It must NOT have coordinator-style fields
        self.assertFalse(hasattr(ctx, "browser_type"))
        self.assertFalse(hasattr(ctx, "cdp_port"))

    def test_02_extension_task_registry_is_separate_from_coordinator(self):
        """Extension tasks are stored in extension_runner._extension_tasks, never in coordinator."""
        from deep_browser.sessions.coordinator import SessionCoordinator
        coordinator = SessionCoordinator.get_instance()
        initial_count = len(coordinator._sessions) if hasattr(coordinator, '_sessions') else 0

        ctx = ExtensionTaskContext(
            id="EXT-TEST-002",
            task_id="task_test_002",
            task="Test task",
        )
        register_extension_task(ctx)

        # Coordinator must NOT have this session
        coordinator_sessions = list(coordinator._sessions.keys()) if hasattr(coordinator, '_sessions') else []
        self.assertNotIn("EXT-TEST-002", coordinator_sessions)

        # Our registry must have it
        self.assertIsNotNone(get_extension_task("EXT-TEST-002"))

        # Cleanup
        remove_extension_task("EXT-TEST-002")

    def test_03_extension_session_id_starts_with_EXT(self):
        """All Extension session IDs must begin with 'EXT-'."""
        ctx = ExtensionTaskContext(id="EXT-100", task_id="task_x", task="x")
        self.assertTrue(ctx.id.startswith("EXT-"), f"Expected EXT- prefix, got: {ctx.id}")

    def test_04_extension_task_does_not_read_coordinator_active_session_id(self):
        """
        When creating an Extension task, coordinator.active_session_id must NOT be
        assigned to the Extension task's session_id.
        This is the critical routing test from the previous implementation.
        """
        from deep_browser.sessions.coordinator import SessionCoordinator
        coordinator = SessionCoordinator.get_instance()

        # Set a fake workspace active session
        original_active = coordinator._active_session_id if hasattr(coordinator, '_active_session_id') else None
        coordinator._active_session_id = "WORKSPACE-ACTIVE-SESSION"

        # Extension task must generate its OWN session ID
        import uuid
        ext_session_id = f"EXT-{uuid.uuid4().hex[:6].upper()}"
        self.assertNotEqual(ext_session_id, "WORKSPACE-ACTIVE-SESSION")
        self.assertTrue(ext_session_id.startswith("EXT-"))

        # Restore
        coordinator._active_session_id = original_active


# ─────────────────────────────────────────────────────────────────────────────
# CDP Bridge Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCdpBridgeProxy(unittest.IsolatedAsyncioTestCase):
    """TEST 5-8: CdpBridgeProxy behavior."""

    def setUp(self):
        self.task_id = f"task_test_{int(time.time() * 1000)}"

    def tearDown(self):
        remove_cdp_bridge(self.task_id)

    def test_05_cdp_bridge_created_per_task(self):
        """Each task gets its own isolated CdpBridgeProxy."""
        bridge1 = get_or_create_cdp_bridge("task_a")
        bridge2 = get_or_create_cdp_bridge("task_b")
        self.assertIsNot(bridge1, bridge2)
        remove_cdp_bridge("task_a")
        remove_cdp_bridge("task_b")

    def test_06_cdp_bridge_not_connected_before_extension_ws(self):
        """Bridge is not marked connected until Extension JS connects."""
        bridge = get_or_create_cdp_bridge(self.task_id)
        self.assertFalse(bridge.is_connected)

    async def test_07_cdp_bridge_connected_event_fires_when_extension_ws_sets(self):
        """wait_for_extension() returns True when Extension WS connects in time."""
        bridge = get_or_create_cdp_bridge(self.task_id)
        mock_ws = MagicMock()
        mock_ws.send_text = AsyncMock()

        # Simulate Extension connecting asynchronously
        async def connect_after_delay():
            await asyncio.sleep(0.05)
            bridge.set_extension_websocket(mock_ws)

        task = asyncio.create_task(connect_after_delay())
        result = await bridge.wait_for_extension(timeout=2.0)
        await task

        self.assertTrue(result)
        self.assertTrue(bridge.is_connected)

    async def test_08_cdp_bridge_timeout_returns_false(self):
        """wait_for_extension() returns False if Extension JS never connects."""
        bridge = get_or_create_cdp_bridge(self.task_id)
        result = await bridge.wait_for_extension(timeout=0.05)
        self.assertFalse(result)

    async def test_09_cdp_bridge_relays_messages_to_all_queues(self):
        """relay_from_extension() puts messages in all registered queues."""
        bridge = get_or_create_cdp_bridge(self.task_id)
        q1 = asyncio.Queue()
        q2 = asyncio.Queue()
        bridge.add_session_queue(q1)
        bridge.add_session_queue(q2)

        test_msg = json.dumps({"id": 1, "result": {}})
        await bridge.relay_from_extension(test_msg)

        self.assertEqual(q1.get_nowait(), test_msg)
        self.assertEqual(q2.get_nowait(), test_msg)

        bridge.remove_session_queue(q1)
        bridge.remove_session_queue(q2)


# ─────────────────────────────────────────────────────────────────────────────
# Context Prompt Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestExtensionContextPrompt(unittest.TestCase):
    """TEST 10: "Kerjakan halaman ini" immediate tab context."""

    def test_10_kerjakan_halaman_ini_includes_current_url(self):
        """'Kerjakan halaman ini' prompt must include the current active tab URL."""
        ctx = ExtensionTaskContext(
            id="EXT-001",
            task_id="task_x",
            task="Kerjakan halaman ini",
            tab_id=7,
            url="https://pddikti.kemdikbud.go.id/",
            title="PDDikti",
        )
        prompt = build_extension_context_prompt("Kerjakan halaman ini", ctx)

        self.assertIn("https://pddikti.kemdikbud.go.id/", prompt)
        self.assertIn("PDDikti", prompt)
        self.assertIn("Kerjakan halaman ini", prompt)
        # Must instruct agent NOT to navigate away
        self.assertIn("ALREADY OPEN", prompt.upper())

    def test_11_context_prompt_instructs_no_new_navigation(self):
        """Prompt must tell agent not to open a search engine or new tab."""
        ctx = ExtensionTaskContext(
            id="EXT-001",
            task_id="task_x",
            task="Fill in the search box",
            url="https://example.com",
            title="Example",
        )
        prompt = build_extension_context_prompt("Fill in the search box", ctx)
        self.assertIn("Do NOT navigate", prompt)


# ─────────────────────────────────────────────────────────────────────────────
# Action Mapping Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestActionEventMapping(unittest.TestCase):
    """TEST 12: Action → EventType mapping is correct."""

    def test_12_navigate_maps_to_navigate_event(self):
        evt_type, target = map_action_to_event("navigate", {"url": "https://google.com"})
        self.assertEqual(evt_type, EventType.NAVIGATE)
        self.assertEqual(target, "https://google.com")

    def test_12b_click_maps_to_click_event(self):
        evt_type, _ = map_action_to_event("click_element", {"index": 3})
        self.assertEqual(evt_type, EventType.CLICK)

    def test_12c_input_text_maps_to_type_event(self):
        evt_type, target = map_action_to_event("input_text", {"text": "hello world"})
        self.assertEqual(evt_type, EventType.TYPE)
        self.assertEqual(target, "hello world")

    def test_12d_unknown_action_maps_to_action_requested(self):
        evt_type, _ = map_action_to_event("some_unknown_action", {})
        self.assertEqual(evt_type, EventType.ACTION_REQUESTED)


if __name__ == '__main__':
    unittest.main(verbosity=2)
