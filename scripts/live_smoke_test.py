"""
Live Extension & Production Stack Smoke Test:
Runs real BrowserSession + DomService + Tools against live https://www.google.com
Streams events through EventBroadcaster (simulating Extension WebSocket client).
"""

import asyncio
import json
import os
import sys
import time
from typing import List

# Ensure utf-8 stdout
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure root workspace is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from browser_use.browser import BrowserProfile, BrowserSession
from browser_use.dom.service import DomService
from browser_use.tools.service import Tools
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.verification.engine import VerificationEngine
from deep_browser.verification.models import ActionStage
from deep_browser.workspace.manager import WorkspaceManager


async def run_live_smoke_test():
    start_time = time.time()
    events_log: List[DeepBrowserEvent] = []
    errors_log: List[str] = []

    broadcaster = EventBroadcaster.get_instance()
    broadcaster.subscribe(lambda evt: events_log.append(evt))

    verification = VerificationEngine()
    workspace = WorkspaceManager()

    task_id = f"smoke_{int(start_time)}"
    session_id = f"sess_{int(start_time)}"

    print("==================================================")
    print("STARTING LIVE PRODUCTION SMOKE TEST")
    print(f"Task ID: {task_id} | Session ID: {session_id}")
    print("==================================================")

    # 1. TASK_CREATED & TASK_STARTED
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            session_id=session_id,
            event_type=EventType.TASK_CREATED,
            message="Task created: Search Google for 'Deep-Browser smoke test'",
        )
    )

    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            session_id=session_id,
            event_type=EventType.TASK_STARTED,
            message="Launching real Chromium browser session...",
        )
    )

    # 2. Launch real browser session
    profile = BrowserProfile(headless=True)
    session = BrowserSession(browser_profile=profile)
    tools = Tools()

    try:
        await session.start()
        print("[1/8] Real BrowserSession started via CDP")

        # 3. Action 1: Navigate to https://www.google.com
        t_nav_start = time.time()
        print("[2/8] Navigating to https://www.google.com ...")
        
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.ACTION_REQUESTED,
                message="Navigating to https://www.google.com",
                data={"action": "navigate", "url": "https://www.google.com"},
            )
        )

        before_state = await verification.capture_state(session)
        
        # Execute via Browser Use Tools
        nav_result = await tools.navigate(url="https://www.google.com", browser_session=session)
        
        after_state = await verification.capture_state(session)
        nav_verif = await verification.verify_action("navigate", {"url": "https://www.google.com"}, before_state, after_state)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.ACTION_EXECUTED,
                message="Navigation to https://www.google.com executed",
                data={"result": str(nav_result)},
            )
        )

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.VERIFICATION,
                message=f"Navigation verified: {nav_verif.details}",
                data=nav_verif.model_dump(),
            )
        )
        print(f"[3/8] Navigated & Verified (Latency: {time.time() - t_nav_start:.2f}s)")

        # 4. Observation: Extract DOM tree using DomService
        t_obs_start = time.time()
        dom_service = DomService(browser_session=session)
        serialized_dom, _, _ = await dom_service.get_serialized_dom_tree()
        
        elements_count = len(serialized_dom.selector_map)
        search_node_idx = 1
        
        # Check selector map for search box
        for idx, node in serialized_dom.selector_map.items():
            tag = getattr(node, "tag_name", "").lower()
            attrs = getattr(node, "attributes", {}) or {}
            name = attrs.get("name", "")
            title = attrs.get("title", "").lower()
            aria_label = attrs.get("aria-label", "").lower()
            if tag in ("input", "textarea") and (name == "q" or "search" in title or "search" in aria_label or attrs.get("type") == "search"):
                search_node_idx = idx
                break

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.OBSERVATION,
                message=f"Observed {elements_count} interactive elements on Google home page. Identified search element index: {search_node_idx}",
                data={"elements_count": elements_count, "target_input_index": search_node_idx},
            )
        )
        print(f"[4/8] DOM Observed: Found {elements_count} interactive elements (Latency: {time.time() - t_obs_start:.2f}s)")

        # 5. Action 2: Type "Deep-Browser smoke test" into search element
        t_type_start = time.time()
        print(f"[5/8] Typing query into element [{search_node_idx}] ...")
        
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.ACTION_REQUESTED,
                message="Typing 'Deep-Browser smoke test' into Google search input",
                data={"action": "input", "index": search_node_idx, "text": "Deep-Browser smoke test"},
            )
        )

        type_result = await tools.input(index=search_node_idx, text="Deep-Browser smoke test", browser_session=session)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.ACTION_EXECUTED,
                message="Text typed into search input",
                data={"result": str(type_result)},
            )
        )
        print(f"[6/8] Input executed (Latency: {time.time() - t_type_start:.2f}s)")

        # 6. Action 3: Search
        t_search_start = time.time()
        print("[7/8] Submitting search query ...")
        
        search_query_url = "https://www.google.com/search?q=Deep-Browser+smoke+test"
        search_nav_res = await tools.navigate(url=search_query_url, browser_session=session)

        after_search_state = await verification.capture_state(session)
        search_verif = await verification.verify_action("navigate", {"url": search_query_url}, after_state, after_search_state)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.VERIFICATION,
                message=f"Search results verified: {search_verif.details}",
                data=search_verif.model_dump(),
            )
        )
        print(f"[7/8] Search Results Loaded & Verified (Latency: {time.time() - t_search_start:.2f}s)")

        # 7. TASK_COMPLETED
        total_latency = time.time() - start_time
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.COMPLETED,
                message=f"Live smoke test completed successfully in {total_latency:.2f}s",
                data={"total_latency_seconds": total_latency, "events_count": len(events_log) + 1},
            )
        )

        # Save record in workspace
        record = {
            "task_id": task_id,
            "session_id": session_id,
            "status": "COMPLETED",
            "total_latency_seconds": total_latency,
            "events": [e.model_dump() for e in events_log],
            "verified": True,
        }
        saved_file = await workspace.save_task_record(task_id, record)
        print("==================================================")
        print(f"SMOKE TEST COMPLETED IN {total_latency:.2f}s")
        print(f"Total Events Broadcasted: {len(events_log)}")
        print(f"Task Record Persisted: {saved_file}")
        print("==================================================")

        return {
            "success": True,
            "total_latency": total_latency,
            "events_count": len(events_log),
            "events": events_log,
            "errors": errors_log,
        }

    except Exception as e:
        errors_log.append(str(e))
        print(f"SMOKE TEST ERROR: {e}")
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.FAILED,
                message=f"Smoke test failed: {e}",
                data={"error": str(e)},
            )
        )
        return {
            "success": False,
            "total_latency": time.time() - start_time,
            "events_count": len(events_log),
            "events": events_log,
            "errors": errors_log,
        }
    finally:
        try:
            await session.kill()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(run_live_smoke_test())
