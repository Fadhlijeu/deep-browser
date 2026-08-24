"""
Unit Tests: ExtensionBrowserSession & ExtensionTransport
========================================================

Verifies that ExtensionBrowserSession conforms to BrowserSession interface,
correctly dispatches events over ExtensionTransport, and properly constructs
BrowserStateSummary from raw DOM elements.
"""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from browser_use.browser.events import (
    ClickElementEvent,
    NavigateToUrlEvent,
    ScrollEvent,
    TypeTextEvent,
)
from browser_use.browser.views import BrowserStateSummary
from browser_use.dom.views import EnhancedDOMTreeNode, NodeType
from deep_browser.bridge.extension_session import (
    ExtensionBrowserSession,
    ExtensionTransport,
    _build_dom_tree_from_elements,
    get_or_create_extension_transport,
    remove_extension_transport,
)


class TestExtensionBrowserSession(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.task_id = "test_task_001"
        self.transport = get_or_create_extension_transport(self.task_id)
        self.session = ExtensionBrowserSession(
            transport=self.transport,
            initial_url="https://example.com",
            initial_title="Example Page",
            initial_tab_id=101,
        )

    async def asyncTearDown(self):
        remove_extension_transport(self.task_id)
        await self.session.close()

    def test_dom_tree_construction(self):
        """Test converting raw Extension elements into SimplifiedNode tree and DOMSelectorMap."""
        raw_elements = [
            {
                "index": 1,
                "tag": "input",
                "type": "text",
                "placeholder": "Search...",
                "xpath": '//*[@id="search"]',
                "name": "q",
            },
            {
                "index": 2,
                "tag": "button",
                "text": "Submit Search",
                "xpath": '//*[@id="btn-submit"]',
                "role": "button",
            },
        ]

        root, selector_map = _build_dom_tree_from_elements(
            raw_elements, "https://example.com", "Example Page"
        )

        self.assertEqual(root.original_node.node_name, "BODY")
        self.assertEqual(len(root.children), 2)
        self.assertIn(1, selector_map)
        self.assertIn(2, selector_map)

        node1 = selector_map[1]
        self.assertEqual(node1.node_name, "INPUT")
        self.assertEqual(node1.attributes.get("placeholder"), "Search...")

        node2 = selector_map[2]
        self.assertEqual(node2.node_name, "BUTTON")
        self.assertEqual(node2.node_value, "Submit Search")

    async def test_get_browser_state_summary(self):
        """Test get_browser_state_summary requests state from transport and builds BrowserStateSummary."""
        async def mock_transport_loop():
            # Wait for GET_STATE command in send_queue
            msg = await self.transport.send_queue.get()
            self.assertEqual(msg["command"], "GET_STATE")
            req_id = msg["request_id"]

            # Push response
            await self.transport.push_incoming({
                "request_id": req_id,
                "result": {
                    "url": "https://pddikti.kemdiktisaintek.go.id",
                    "title": "PDDikti",
                    "tabs": [{"url": "https://pddikti.kemdiktisaintek.go.id", "title": "PDDikti", "id": 101}],
                    "elements": [
                        {"index": 1, "tag": "input", "placeholder": "Cari Mahasiswa", "xpath": "//input[@id='search']"},
                        {"index": 2, "tag": "button", "text": "Cari", "xpath": "//button[@type='submit']"},
                    ],
                    "screenshot": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    "page_info": {"viewport_width": 1280, "viewport_height": 800},
                }
            })

        transport_task = asyncio.create_task(mock_transport_loop())
        self.transport.mark_connected()

        summary = await self.session.get_browser_state_summary(include_screenshot=True)

        await transport_task
        self.assertIsInstance(summary, BrowserStateSummary)
        self.assertEqual(summary.url, "https://pddikti.kemdiktisaintek.go.id")
        self.assertEqual(summary.title, "PDDikti")
        self.assertIsNotNone(summary.screenshot)
        self.assertEqual(len(summary.dom_state.selector_map), 2)

        # Verify get_element_by_index resolves from selector_map
        el = await self.session.get_element_by_index(1)
        self.assertIsNotNone(el)
        self.assertEqual(el.attributes.get("placeholder"), "Cari Mahasiswa")

    async def test_action_event_dispatch_navigate(self):
        """Test NavigateToUrlEvent translates to NAVIGATE transport command."""
        async def mock_transport_loop():
            msg = await self.transport.send_queue.get()
            self.assertEqual(msg["command"], "NAVIGATE")
            self.assertEqual(msg["params"]["url"], "https://google.com")
            req_id = msg["request_id"]
            await self.transport.push_incoming({
                "request_id": req_id,
                "result": {"success": True, "url": "https://google.com"}
            })

        transport_task = asyncio.create_task(mock_transport_loop())
        self.transport.mark_connected()

        event = NavigateToUrlEvent(url="https://google.com", new_tab=False)
        res_task = asyncio.create_task(self.session.on_NavigateToUrlEvent(event))
        await transport_task
        await res_task

        self.assertEqual(self.session._current_url, "https://google.com")


    async def test_action_event_dispatch_click(self):
        """Test ClickElementEvent translates to CLICK transport command."""
        node = EnhancedDOMTreeNode(
            node_id=3,
            backend_node_id=3,
            node_type=NodeType.ELEMENT_NODE,
            node_name="BUTTON",
            node_value="Click Me",
            attributes={},
            is_scrollable=False,
            is_visible=True,
            absolute_position=None,
            target_id="tab1",
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

        async def mock_transport_loop():
            msg = await self.transport.send_queue.get()
            self.assertEqual(msg["command"], "CLICK")
            self.assertEqual(msg["params"]["index"], 3)
            req_id = msg["request_id"]
            await self.transport.push_incoming({
                "request_id": req_id,
                "result": {"success": True}
            })

        transport_task = asyncio.create_task(mock_transport_loop())
        self.transport.mark_connected()

        event = ClickElementEvent(node=node)
        res_task = asyncio.create_task(self.session.on_ClickElementEvent(event))
        await transport_task
        res = await res_task

        self.assertTrue(res.get("success"))

    async def test_action_event_dispatch_type(self):
        """Test TypeTextEvent translates to TYPE transport command."""
        node = EnhancedDOMTreeNode(
            node_id=4,
            backend_node_id=4,
            node_type=NodeType.ELEMENT_NODE,
            node_name="INPUT",
            node_value="",
            attributes={"placeholder": "Name"},
            is_scrollable=False,
            is_visible=True,
            absolute_position=None,
            target_id="tab1",
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

        async def mock_transport_loop():
            msg = await self.transport.send_queue.get()
            self.assertEqual(msg["command"], "TYPE")
            self.assertEqual(msg["params"]["index"], 4)
            self.assertEqual(msg["params"]["text"], "Muhammad Fadhli")
            req_id = msg["request_id"]
            await self.transport.push_incoming({
                "request_id": req_id,
                "result": {"success": True}
            })

        transport_task = asyncio.create_task(mock_transport_loop())
        self.transport.mark_connected()

        event = TypeTextEvent(node=node, text="Muhammad Fadhli", clear=True)
        res_task = asyncio.create_task(self.session.on_TypeTextEvent(event))
        await transport_task
        res = await res_task

        self.assertTrue(res.get("success"))




if __name__ == "__main__":
    unittest.main()

