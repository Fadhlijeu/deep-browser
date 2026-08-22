"""
FastAPI + WebSocket companion bridge server connecting Chrome Extension MV3
directly to the root browser_use agent core with Safe Mode confirmation gateways,
Cloudflare / verification challenge handoff, and full session/agent lifecycle control.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Union
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from browser_use import Agent, BrowserProfile, BrowserSession, Tools
from browser_use.llm.google.chat import ChatGoogle
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModeManager, SafeModePolicy, SafeTools
from deep_browser.sessions.coordinator import SessionCoordinator, SessionViewModel
from deep_browser.verification.engine import VerificationEngine
from deep_browser.workspace.manager import WorkspaceManager

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Deep-Browser Companion Server",
    description="Local bridge server connecting Chrome Extension MV3 to Browser Use core",
    version="0.13.8",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core singletons
broadcaster = EventBroadcaster.get_instance()
coordinator = SessionCoordinator.get_instance()
workspace = WorkspaceManager()
verification = VerificationEngine()
safe_manager = SafeModeManager.get_instance()

# Active tasks state
active_agents: Dict[str, Agent] = {}
active_tasks: Dict[str, Dict[str, Any]] = {}


class CreateTaskRequest(BaseModel):
    task: str
    session_id: Optional[str] = None
    browser_mode: str = Field(default="ATTACHED", description="ATTACHED (user's current Chrome) or MANAGED")
    browser_id: Optional[str] = "chrome_9222"
    tab_id: Optional[Union[str, int]] = None
    model_provider: str = Field(default="gemini", description="gemini, openai, anthropic, or ollama")
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    attached_mode: bool = True
    cdp_port: int = 9222
    headless: bool = False
    safe_mode: bool = True
    safe_timeout_seconds: float = 60.0
    challenge_timeout_seconds: float = 60.0


class AttachChromeRequest(BaseModel):
    name: str = "Current Chrome"
    cdp_port: int = 9222
    cdp_url: Optional[str] = None


class CreateManagedSessionRequest(BaseModel):
    name: str = "Managed Session"
    headless: bool = False
    user_data_dir: Optional[str] = None
    profile_directory: Optional[str] = None


class ConfirmationDecisionRequest(BaseModel):
    decision: str = Field(description="CONFIRM or REJECT")


def _create_llm(provider: str, model_name: Optional[str], api_key: Optional[str]):
    # Primary model strictly locked to gemini-3.5-flash-lite
    import os
    model = model_name or os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite"
    return ChatGoogle(model=model, api_key=api_key)


# --- System & Session Management Endpoints ---

@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "app": "deep-browser",
        "version": "0.13.8",
        "active_tasks": len(active_tasks),
        "active_sessions": len(await coordinator.list_session_views()),
        "active_session_id": coordinator.active_session_id,
    }


@app.get("/api/sessions")
async def list_sessions():
    views = await coordinator.list_session_views()
    return {
        "sessions": [v.model_dump() for v in views],
        "active_session_id": coordinator.active_session_id,
    }


@app.post("/api/sessions/attach")
async def attach_chrome(req: AttachChromeRequest):
    try:
        view = await coordinator.attach_system_chrome(cdp_port=req.cdp_port, cdp_url=req.cdp_url)
        return {"status": "success", "session": view.model_dump()}
    except Exception as e:
        logger.error(f"Error attaching to Chrome: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/managed")
async def create_managed(req: CreateManagedSessionRequest):
    try:
        view = await coordinator.create_managed_session(
            name=req.name,
            headless=req.headless,
            user_data_dir=req.user_data_dir,
            profile_directory=req.profile_directory,
        )
        return {"status": "success", "session": view.model_dump()}
    except Exception as e:
        logger.error(f"Error creating managed session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/switch")
async def switch_session(session_id: str):
    success = coordinator.set_active_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session ID not found")
    return {"status": "success", "active_session_id": session_id}


@app.get("/api/browser/state")
async def get_browser_state():
    session = coordinator.get_active_session()
    if not session:
        return {"status": "no_active_session", "tabs": []}

    try:
        tabs = await session.get_tabs()
        return {
            "status": "connected",
            "session_id": coordinator.active_session_id,
            "tabs": [{"id": t.target_id, "url": t.url, "title": t.title} for t in tabs],
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "tabs": []}


# --- Task Execution Endpoints ---

@app.post("/api/tasks")
async def create_task(req: CreateTaskRequest):
    task_id = f"task_{int(time.time() * 1000)}"
    is_attached = (req.browser_mode.upper() == "ATTACHED") or req.attached_mode
    browser_mode = "ATTACHED" if is_attached else "MANAGED"
    browser_id = req.browser_id or ("chrome_9222" if is_attached else "bundled_chromium")

    active_tasks[task_id] = {
        "id": task_id,
        "task": req.task,
        "browser_mode": browser_mode,
        "browser_id": browser_id,
        "tab_id": req.tab_id,
        "status": "created",
        "created_at": time.time(),
    }

    # Broadcast task created with full metadata
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            session_id=req.session_id,
            browser_mode=browser_mode,
            browser_id=browser_id,
            tab_id=req.tab_id,
            event_type=EventType.TASK_CREATED,
            message=f"Task created: {req.task}",
            data={"task": req.task, "browser_mode": browser_mode, "browser_id": browser_id, "safe_mode": req.safe_mode},
        )
    )

    # Launch in background
    asyncio.create_task(_run_task_background(task_id, req))
    return {
        "task_id": task_id,
        "status": "created",
        "session_id": req.session_id or f"sess_{task_id}",
        "browser_mode": browser_mode,
        "browser_id": browser_id,
        "tab_id": req.tab_id,
    }


async def _run_task_background(task_id: str, req: CreateTaskRequest):
    agent = None
    session_id = req.session_id or coordinator.active_session_id
    is_attached = (req.browser_mode.upper() == "ATTACHED") or req.attached_mode
    browser_mode = "ATTACHED" if is_attached else "MANAGED"
    browser_id = req.browser_id or ("chrome_9222" if is_attached else "bundled_chromium")
    tab_id = req.tab_id

    try:
        session = None
        if session_id:
            session = coordinator.get_session(session_id)

        if not session:
            # Create according to request mode
            if is_attached:
                view = await coordinator.attach_system_chrome(cdp_port=req.cdp_port)
                if view.status == 'error':
                    raise RuntimeError(f"Chrome remote debugging port ({req.cdp_port}) is not active. To use Attached mode, launch Chrome with: chrome.exe --remote-debugging-port={req.cdp_port}, or switch to Bundled Chromium in Desktop.")
                session_id = view.id
                session = coordinator.get_session(session_id)
            else:
                view = await coordinator.create_managed_session(headless=req.headless)
                session_id = view.id
                session = coordinator.get_session(session_id)

        assert session is not None, "Failed to initialize BrowserSession"

        llm = _create_llm(req.model_provider, req.model_name, req.api_key)

        # Instantiate SafeTools directly over Browser Use Tools
        policy = SafeModePolicy(enabled=req.safe_mode, timeout_seconds=req.safe_timeout_seconds)
        tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

        # Step callback broadcasting observation, thinking, actions & challenges
        async def step_callback(state_summary, agent_output, step_num):
            url = getattr(state_summary, "url", "")
            title = getattr(state_summary, "title", "")
            thinking = getattr(agent_output.current_state, "thinking", None) if agent_output else None
            next_goal = getattr(agent_output.current_state, "next_goal", None) if agent_output else None

            # 1. Broadcast Observation & High-Level Status Summary
            await broadcaster.broadcast(
                DeepBrowserEvent(
                    task_id=task_id,
                    session_id=session_id,
                    browser_mode=browser_mode,
                    browser_id=browser_id,
                    tab_id=tab_id,
                    event_type=EventType.OBSERVATION,
                    status="OBSERVED",
                    summary=f"Observing {title or url or 'page'}",
                    message=f"Step {step_num}: {url}",
                    data={
                        "step": step_num,
                        "url": url,
                        "title": title,
                        "thought": thinking,
                        "next_goal": next_goal,
                    },
                )
            )

            # 2. Check for Cloudflare / Verification Challenge
            lower_title = title.lower() if title else ""
            lower_url = url.lower() if url else ""
            is_challenge = (
                "just a moment" in lower_title
                or "cloudflare" in lower_title
                or "attention required" in lower_title
                or "verify you are human" in lower_title
                or "verifikasi" in lower_title
                or "challenges.cloudflare.com" in lower_url
            )

            if is_challenge:
                await broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=task_id,
                        session_id=session_id,
                        browser_mode=browser_mode,
                        browser_id=browser_id,
                        tab_id=tab_id,
                        event_type=EventType.CHALLENGE_REQUIRED,
                        status="BLOCKED",
                        summary="Cloudflare / Verification challenge detected",
                        message="Verification challenge detected. Waiting for user interaction or page resolution...",
                        data={"url": url, "title": title, "timeout_seconds": req.challenge_timeout_seconds},
                    )
                )

                # Watchdog polling loop
                start_wait = time.time()
                while time.time() - start_wait < req.challenge_timeout_seconds:
                    await asyncio.sleep(1.5)
                    try:
                        cur_title = await session.get_title() if hasattr(session, "get_title") else ""
                        if cur_title and "just a moment" not in cur_title.lower() and "cloudflare" not in cur_title.lower() and "attention required" not in cur_title.lower():
                            await broadcaster.broadcast(
                                DeepBrowserEvent(
                                    task_id=task_id,
                                    session_id=session_id,
                                    browser_mode=browser_mode,
                                    browser_id=browser_id,
                                    tab_id=tab_id,
                                    event_type=EventType.CHALLENGE_RESOLVED,
                                    status="RESUMED",
                                    summary="Verification detected. Resuming task...",
                                    message="Verification detected. Resuming task execution.",
                                )
                            )
                            break
                    except Exception:
                        pass
                else:
                    await broadcaster.broadcast(
                        DeepBrowserEvent(
                            task_id=task_id,
                            session_id=session_id,
                            browser_mode=browser_mode,
                            browser_id=browser_id,
                            tab_id=tab_id,
                            event_type=EventType.CHALLENGE_TIMEOUT,
                            status="TIMED_OUT",
                            summary="Verification challenge timed out",
                            message=f"Challenge verification timed out after {req.challenge_timeout_seconds}s.",
                        )
                    )

            # 3. Broadcast individual discrete actions
            if agent_output and getattr(agent_output, "action", None):
                for act in agent_output.action:
                    act_dump = act.model_dump(exclude_unset=True) if hasattr(act, "model_dump") else {}
                    for act_name, act_params in act_dump.items():
                        target_str = ""
                        evt_type = EventType.ACTION_REQUESTED
                        if act_name == "navigate":
                            evt_type = EventType.NAVIGATE
                            target_str = act_params.get("url", "") if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "click_element":
                            evt_type = EventType.CLICK
                            target_str = f"Element #{act_params.get('index', '')}" if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "input_text":
                            evt_type = EventType.TYPE
                            target_str = act_params.get("text", "") if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "scroll_page":
                            evt_type = EventType.SCROLL
                            target_str = str(act_params)
                        elif act_name == "wait":
                            evt_type = EventType.WAIT
                            target_str = f"{act_params.get('seconds', '')}s" if isinstance(act_params, dict) else str(act_params)

                        await broadcaster.broadcast(
                            DeepBrowserEvent(
                                task_id=task_id,
                                session_id=session_id,
                                browser_mode=browser_mode,
                                browser_id=browser_id,
                                tab_id=tab_id,
                                event_type=evt_type,
                                action=act_name,
                                target=target_str,
                                status="EXECUTING",
                                summary=f"{act_name}: {target_str}",
                                data=act_params if isinstance(act_params, dict) else {},
                            )
                        )

        agent = Agent(
            task=req.task,
            llm=llm,
            browser_session=session,
            tools=tools,
            register_new_step_callback=step_callback,
        )

        active_agents[task_id] = agent
        coordinator.set_active_agent(agent, task_id)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.TASK_STARTED,
                message="Agent execution started",
            )
        )

        # Execute Browser Use Agent loop
        result = await agent.run()

        active_tasks[task_id]["status"] = "completed"
        active_tasks[task_id]["result"] = str(result)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.COMPLETED,
                message="Task completed successfully",
                data={"result": str(result)},
            )
        )
        await workspace.save_task_record(task_id, active_tasks[task_id])

    except Exception as e:
        logger.error(f"Error in task {task_id}: {e}", exc_info=True)
        err_msg = str(e)
        if "ConnectError" in type(e).__name__ or "All connection attempts failed" in err_msg:
            err_msg = f"Connection failed to Chrome on port {req.cdp_port}. Please start Chrome with '--remote-debugging-port={req.cdp_port}', or switch to Bundled Chromium in Desktop."
        if task_id in active_tasks:
            active_tasks[task_id]["status"] = "failed"
            active_tasks[task_id]["error"] = err_msg
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id if 'session_id' in locals() else None,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.FAILED,
                message=f"Task failed: {err_msg}",
                data={"error": err_msg},
            )
        )
    finally:
        active_agents.pop(task_id, None)
        if coordinator.get_active_agent() == agent:
            coordinator.set_active_agent(None, "")


# --- Interactive Safe Mode Confirmation ---

@app.post("/api/confirmations/{confirmation_id}")
async def submit_confirmation_decision(confirmation_id: str, req: ConfirmationDecisionRequest):
    resolved = safe_manager.resolve_confirmation(confirmation_id, req.decision)
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail="Confirmation ID not found, already resolved, or expired."
        )
    return {
        "status": "success",
        "confirmation_id": confirmation_id,
        "decision": req.decision.upper(),
    }


# --- Agent Lifecycle Control Endpoints ---

@app.post("/api/agent/pause")
async def pause_agent():
    success = coordinator.pause_active_agent()
    if not success:
        for agent in active_agents.values():
            agent.pause()
            success = True
    if success:
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id="active",
                event_type=EventType.PAUSED,
                message="Agent paused by user",
            )
        )
        return {"status": "paused"}
    return {"status": "no_active_agent"}


@app.post("/api/agent/resume")
async def resume_agent():
    success = coordinator.resume_active_agent()
    if not success:
        for agent in active_agents.values():
            agent.resume()
            success = True
    if success:
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id="active",
                event_type=EventType.RESUMED,
                message="Agent resumed by user",
            )
        )
        return {"status": "resumed"}
    return {"status": "no_active_agent"}


@app.post("/api/agent/stop")
async def stop_agent():
    success = coordinator.stop_active_agent()
    if not success:
        for agent in active_agents.values():
            agent.stop()
            success = True
    if success:
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id="active",
                event_type=EventType.STOPPED,
                message="Agent stopped by user",
            )
        )
        return {"status": "stopped"}
    return {"status": "no_active_agent"}


# --- WebSocket Real-Time Event Stream ---

@app.websocket("/ws/extension")
async def extension_ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue = await broadcaster.register_client()
    try:
        while True:
            # Check for incoming client messages or forward broadcast events
            try:
                receive_task = asyncio.create_task(websocket.receive_text())
                broadcast_task = asyncio.create_task(queue.get())

                done, pending = await asyncio.wait(
                    [receive_task, broadcast_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()

                if receive_task in done:
                    client_msg = receive_task.result()
                    try:
                        msg_data = json.loads(client_msg)
                        if msg_data.get("type") == "CONFIRMATION_DECISION":
                            conf_id = msg_data.get("confirmation_id")
                            dec = msg_data.get("decision")
                            if conf_id and dec:
                                safe_manager.resolve_confirmation(conf_id, dec)
                    except Exception as e:
                        logger.error(f"Error handling extension client message: {e}")

                if broadcast_task in done:
                    event: DeepBrowserEvent = broadcast_task.result()
                    await websocket.send_text(json.dumps(event.model_dump(), default=str))

            except asyncio.CancelledError:
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await broadcaster.unregister_client(queue)
