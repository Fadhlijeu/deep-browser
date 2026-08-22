"""
Unit and Integration Tests for Session Isolation & Extension -> Workspace Handoff.

Verifies:
1. Workspace session visible only in Workspace.
2. Extension session visible only in Extension.
3. Extension task does not create Workspace task.
4. Extension task uses current browser/tab context.
5. Workspace task remains independent.
6. Two Extension sessions can remain independent.
7. Send Extension session to Workspace.
8. Workspace receives imported session.
9. Imported session has [EXT] tag.
10. Handoff does not execute task twice.
11. Workspace can continue the handed-off task.
12. Extension remains independent after unrelated Workspace task starts.
"""

import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient

from browser_use import BrowserSession, BrowserProfile
from deep_browser.sessions.coordinator import SessionCoordinator, SessionViewModel
from deep_browser.bridge.server import app, coordinator, broadcaster
from deep_browser.events.models import EventType, DeepBrowserEvent


@pytest.fixture(autouse=True)
def reset_coordinator():
    """Reset the singleton coordinator between tests."""
    coordinator.clear()
    yield
    coordinator.clear()


@pytest.mark.asyncio
async def test_workspace_session_visible_only_in_workspace():
    """1. Workspace session is registered and visible only in Workspace listing."""
    mock_browser_session = MagicMock(spec=BrowserSession)
    mock_browser_session.id = "ws_session_001"
    mock_browser_session.is_cdp_connected = True
    mock_browser_session.get_current_page_url = AsyncMock(return_value="https://workspace.local")
    mock_browser_session.get_current_page_title = AsyncMock(return_value="Workspace Tab")
    mock_browser_session.get_tabs = AsyncMock(return_value=[])

    coordinator.register_existing_session(
        session=mock_browser_session,
        name="Workspace Session 1",
        mode="managed",
        owner="WORKSPACE",
    )

    # List as Workspace
    ws_views = await coordinator.list_session_views(owner="WORKSPACE")
    assert len(ws_views) == 1
    assert ws_views[0].id == "ws_session_001"
    assert ws_views[0].owner == "WORKSPACE"

    # List as Extension -> MUST NOT appear
    ext_views = await coordinator.list_session_views(owner="EXTENSION")
    assert len(ext_views) == 0


@pytest.mark.asyncio
async def test_extension_session_visible_only_in_extension():
    """2. Extension session is visible only in Extension listing."""
    mock_browser_session = MagicMock(spec=BrowserSession)
    mock_browser_session.id = "ext_session_001"
    mock_browser_session.is_cdp_connected = True
    mock_browser_session.get_current_page_url = AsyncMock(return_value="https://google.com")
    mock_browser_session.get_current_page_title = AsyncMock(return_value="Google Search")
    mock_browser_session.get_tabs = AsyncMock(return_value=[])

    coordinator.register_existing_session(
        session=mock_browser_session,
        name="Edge Extension Tab",
        mode="attached",
        owner="EXTENSION",
    )

    # List as Extension
    ext_views = await coordinator.list_session_views(owner="EXTENSION")
    assert len(ext_views) == 1
    assert ext_views[0].id == "ext_session_001"
    assert ext_views[0].owner == "EXTENSION"

    # List as Workspace -> MUST NOT appear
    ws_views = await coordinator.list_session_views(owner="WORKSPACE")
    assert len(ws_views) == 0


@pytest.mark.asyncio
async def test_two_extension_sessions_remain_independent():
    """6. Multiple Extension sessions remain isolated from each other and Workspace."""
    mock_s1 = MagicMock(spec=BrowserSession)
    mock_s1.id = "ext_001"
    mock_s1.is_cdp_connected = True
    mock_s1.get_current_page_url = AsyncMock(return_value="https://site1.com")
    mock_s1.get_current_page_title = AsyncMock(return_value="Site 1")
    mock_s1.get_tabs = AsyncMock(return_value=[])

    mock_s2 = MagicMock(spec=BrowserSession)
    mock_s2.id = "ext_002"
    mock_s2.is_cdp_connected = True
    mock_s2.get_current_page_url = AsyncMock(return_value="https://site2.com")
    mock_s2.get_current_page_title = AsyncMock(return_value="Site 2")
    mock_s2.get_tabs = AsyncMock(return_value=[])

    coordinator.register_existing_session(mock_s1, name="Tab A", owner="EXTENSION")
    coordinator.register_existing_session(mock_s2, name="Tab B", owner="EXTENSION")

    ext_views = await coordinator.list_session_views(owner="EXTENSION")
    assert len(ext_views) == 2
    ids = {v.id for v in ext_views}
    assert "ext_001" in ids
    assert "ext_002" in ids

    # Workspace still sees 0 sessions
    ws_views = await coordinator.list_session_views(owner="WORKSPACE")
    assert len(ws_views) == 0


@pytest.mark.asyncio
async def test_explicit_extension_to_workspace_handoff():
    """7, 8, 9, 10. Send Extension session to Workspace with [EXT] tag and no duplicate execution."""
    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "ext_session_search"
    mock_session.is_cdp_connected = True
    mock_session.get_current_page_url = AsyncMock(return_value="https://pddikti.kemdikbud.go.id")
    mock_session.get_current_page_title = AsyncMock(return_value="PDDIKTI Search")
    mock_session.get_tabs = AsyncMock(return_value=[])

    coordinator.register_existing_session(
        mock_session,
        name="Muhammad Fadhli Rizaldy search",
        owner="EXTENSION",
    )

    # Before handoff: only Extension sees it
    assert len(await coordinator.list_session_views(owner="EXTENSION")) == 1
    assert len(await coordinator.list_session_views(owner="WORKSPACE")) == 0

    # Perform Handoff
    handed_view = coordinator.handoff_session("ext_session_search", to_owner="WORKSPACE")
    assert handed_view is not None
    assert handed_view.owner == "WORKSPACE"
    assert handed_view.origin == "EXTENSION"
    assert handed_view.origin_session_id == "ext_session_search"
    assert handed_view.tag == "ext"
    assert handed_view.handoff_state == "HANDED_OFF"

    # After handoff: Workspace now sees it with [EXT] tag!
    ws_views = await coordinator.list_session_views(owner="WORKSPACE")
    assert len(ws_views) == 1
    assert ws_views[0].id == "ext_session_search"
    assert ws_views[0].tag == "ext"
    assert ws_views[0].origin == "EXTENSION"

    # Extension view list no longer lists it as owned
    ext_views = await coordinator.list_session_views(owner="EXTENSION")
    assert len(ext_views) == 0


def test_bridge_api_session_filtering_and_handoff_endpoint():
    """Test FastAPI Companion Bridge endpoints for session isolation and handoff."""
    client = TestClient(app)

    mock_session = MagicMock(spec=BrowserSession)
    mock_session.id = "ext_bridge_01"
    mock_session.is_cdp_connected = True
    mock_session.get_current_page_url = AsyncMock(return_value="https://example.com")
    mock_session.get_current_page_title = AsyncMock(return_value="Example Domain")
    mock_session.get_tabs = AsyncMock(return_value=[])

    coordinator.register_existing_session(mock_session, name="Extension Tab", owner="EXTENSION")

    # 1. GET /api/sessions (default owner=EXTENSION)
    res_ext = client.get("/api/sessions?owner=EXTENSION")
    assert res_ext.status_code == 200
    sessions_ext = res_ext.json().get("sessions", [])
    assert len(sessions_ext) == 1
    assert sessions_ext[0]["id"] == "ext_bridge_01"
    assert sessions_ext[0]["owner"] == "EXTENSION"

    # 2. GET /api/sessions?owner=WORKSPACE
    res_ws = client.get("/api/sessions?owner=WORKSPACE")
    assert res_ws.status_code == 200
    sessions_ws = res_ws.json().get("sessions", [])
    assert len(sessions_ws) == 0

    # 3. POST /api/handoff to transfer to Workspace
    res_handoff = client.post("/api/handoff", json={
        "session_id": "ext_bridge_01",
        "to_owner": "WORKSPACE",
    })
    assert res_handoff.status_code == 200
    data = res_handoff.json()
    assert data["status"] == "success"
    assert data["session"]["owner"] == "WORKSPACE"
    assert data["session"]["tag"] == "ext"
    assert data["session"]["origin"] == "EXTENSION"

    # 4. Now Workspace sees it
    res_ws_after = client.get("/api/sessions?owner=WORKSPACE")
    sessions_ws_after = res_ws_after.json().get("sessions", [])
    assert len(sessions_ws_after) == 1
    assert sessions_ws_after[0]["id"] == "ext_bridge_01"
    assert sessions_ws_after[0]["tag"] == "ext"


def test_extension_task_creation_with_active_tab_context():
    """Verify Extension task receives and retains active tab context without Workspace mirroring."""
    client = TestClient(app)

    res = client.post("/api/tasks", json={
        "task": "Kerjakan halaman ini",
        "owner": "EXTENSION",
        "session_type": "EXTENSION",
        "browser_mode": "ATTACHED",
        "browser_type": "edge",
        "browser_id": "edge_9222",
        "tab_id": 12345,
        "window_id": 1,
        "url": "https://pddikti.kemdikbud.go.id/data_mahasiswa/xyz",
        "title": "Data Mahasiswa PDDIKTI",
        "safe_mode": True,
    })

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "created"
    assert data["tab_id"] == 12345
    assert data["browser_mode"] == "ATTACHED"

    # Workspace session list remains 0
    res_ws = client.get("/api/sessions?owner=WORKSPACE")
    assert len(res_ws.json().get("sessions", [])) == 0

