"""
FastAPI + WebSocket companion bridge server connecting Chrome Extension MV3
directly to the root browser_use agent core with Safe Mode confirmation gateways
and full session/agent lifecycle control.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional
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
    model_provider: str = Field(default="gemini", description="gemini, openai, anthropic, or ollama")
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    attached_mode: bool = False
    cdp_port: int = 9222
    headless: bool = False
    safe_mode: bool = True
    safe_timeout_seconds: float = 60.0


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
    provider = provider.lower()
    if provider == "gemini":
        model = model_name or "gemini-2.5-flash"
        return ChatGoogle(model=model, api_key=api_key)
    elif provider == "openai":
        from browser_use.llm.openai.chat import ChatOpenAI
        model = model_name or "gpt-4o"
        return ChatOpenAI(model=model, api_key=api_key)
    elif provider == "anthropic":
        from browser_use.llm.anthropic.chat import ChatAnthropic
        model = model_name or "claude-3-5-sonnet-20241022"
        return ChatAnthropic(model=model, api_key=api_key)
    elif provider == "ollama":
        from browser_use.llm.ollama.chat import ChatOllama
        model = model_name or "qwen2.5:7b"
        return ChatOllama(model=model)
    else:
        return ChatGoogle(model=model_name or "gemini-2.5-flash", api_key=api_key)


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
    view = await coordinator.attach_system_chrome(
        name=req.name,
        cdp_port=req.cdp_port,
        cdp_url=req.cdp_url,
    )
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id="system",
            session_id=view.id,
            event_type=EventType.SESSION_ATTACHED,
            message=f"Attached to Chrome on port {req.cdp_port}",
            data=view.model_dump(),
        )
    )
    return view.model_dump()


@app.post("/api/sessions/managed")
async def create_managed_session(req: CreateManagedSessionRequest):
    view = await coordinator.create_managed_session(
        name=req.name,
        headless=req.headless,
        user_data_dir=req.user_data_dir,
        profile_directory=req.profile_directory,
    )
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id="system",
            session_id=view.id,
            event_type=EventType.SESSION_CREATED,
            message=f"Created managed browser session: {req.name}",
            data=view.model_dump(),
        )
    )
    return view.model_dump()


@app.post("/api/sessions/{session_id}/switch")
async def switch_session(session_id: str):
    success = coordinator.switch_active_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    view = await coordinator.get_session_view(session_id)
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id="system",
            session_id=session_id,
            event_type=EventType.SESSION_SWITCHED,
            message=f"Switched active session to {session_id}",
            data=view.model_dump() if view else {},
        )
    )
    return {"status": "success", "active_session_id": session_id}


@app.delete("/api/sessions/{session_id}")
async def close_session(session_id: str):
    await coordinator.close_session(session_id)
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id="system",
            session_id=session_id,
            event_type=EventType.SESSION_CLOSED,
            message=f"Closed session {session_id}",
        )
    )
    return {"status": "success", "closed_session_id": session_id}


@app.get("/api/browser/state")
async def get_browser_state(session_id: Optional[str] = None):
    state = await coordinator.get_browser_state(session_id)
    return state


# --- Task Execution & Lifecycle Endpoints ---

@app.get("/api/tasks")
async def list_tasks():
    return {"tasks": list(active_tasks.values())}


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    task = active_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/tasks")
async def create_task(req: CreateTaskRequest):
    task_id = f"task_{int(time.time() * 1000)}"
    active_tasks[task_id] = {
        "task_id": task_id,
        "task": req.task,
        "status": "running",
        "created_at": time.time(),
        "attached_mode": req.attached_mode,
        "safe_mode": req.safe_mode,
    }

    # Broadcast task created
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.TASK_CREATED,
            message=f"Task created: {req.task}",
            data={"task": req.task, "attached_mode": req.attached_mode, "safe_mode": req.safe_mode},
        )
    )

    # Launch in background
    asyncio.create_task(_run_task_background(task_id, req))
    return {"task_id": task_id, "status": "running"}


async def _run_task_background(task_id: str, req: CreateTaskRequest):
    try:
        # Resolve target BrowserSession
        session = None
        session_id = req.session_id or coordinator.active_session_id

        if session_id:
            session = coordinator.get_session(session_id)

        if not session:
            # Fallback: create according to request flags
            if req.attached_mode:
                view = await coordinator.attach_system_chrome(cdp_port=req.cdp_port)
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

        # Step callback broadcasting observation & action telemetry
        async def step_callback(state_summary, agent_output, step_num):
            await broadcaster.broadcast(
                DeepBrowserEvent(
                    task_id=task_id,
                    session_id=session_id,
                    event_type=EventType.OBSERVATION,
                    message=f"Step {step_num}: {getattr(state_summary, 'url', '')}",
                    data={
                        "step": step_num,
                        "url": getattr(state_summary, "url", ""),
                        "title": getattr(state_summary, "title", ""),
                        "thought": getattr(agent_output.current_state, "thinking", None) if agent_output else None,
                        "next_goal": getattr(agent_output.current_state, "next_goal", None) if agent_output else None,
                    },
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
                event_type=EventType.COMPLETED,
                message="Task completed successfully",
                data={"result": str(result)},
            )
        )
        await workspace.save_task_record(task_id, active_tasks[task_id])

    except Exception as e:
        logger.error(f"Error in task {task_id}: {e}", exc_info=True)
        if task_id in active_tasks:
            active_tasks[task_id]["status"] = "failed"
            active_tasks[task_id]["error"] = str(e)
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id if 'session_id' in locals() else None,
                event_type=EventType.FAILED,
                message=f"Task failed: {e}",
                data={"error": str(e)},
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
    raise HTTPException(status_code=400, detail="No active agent running to pause")


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
    raise HTTPException(status_code=400, detail="No active paused agent to resume")


@app.post("/api/agent/stop")
async def stop_agent():
    success = coordinator.stop_active_agent()
    if not success:
        for agent in list(active_agents.values()):
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
    raise HTTPException(status_code=400, detail="No active agent to stop")


@app.post("/api/tasks/{task_id}/stop")
async def stop_task(task_id: str):
    agent = active_agents.get(task_id)
    if agent:
        try:
            agent.stop()
        except Exception as e:
            logger.warning(f"Error calling agent.stop(): {e}")
    if task_id in active_tasks:
        active_tasks[task_id]["status"] = "stopped"
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=task_id,
            event_type=EventType.STOPPED,
            message="Task stopped by user",
        )
    )
    return {"status": "stopped"}


# --- WebSocket Bridge Endpoint ---

@app.websocket("/ws")
@app.websocket("/ws/extension")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue: asyncio.Queue[DeepBrowserEvent] = asyncio.Queue()

    def listener(event: DeepBrowserEvent):
        queue.put_nowait(event)

    broadcaster.subscribe(listener)

    async def send_events():
        while True:
            event = await queue.get()
            await websocket.send_text(event.model_dump_json())

    async def receive_messages():
        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                msg_type = msg.get("type") or msg.get("event_type")

                if msg_type == "CONFIRMATION_DECISION":
                    conf_id = msg.get("confirmation_id")
                    decision = msg.get("decision", "REJECT")
                    if conf_id:
                        resolved = safe_manager.resolve_confirmation(conf_id, decision)
                        logger.info(f"Resolved confirmation {conf_id} with {decision}: {resolved}")

                elif msg_type == "PAUSE_AGENT":
                    coordinator.pause_active_agent()

                elif msg_type == "RESUME_AGENT":
                    coordinator.resume_active_agent()

                elif msg_type == "STOP_AGENT":
                    coordinator.stop_active_agent()

                elif msg_type == "SWITCH_SESSION":
                    target_sid = msg.get("session_id")
                    if target_sid:
                        coordinator.switch_active_session(target_sid)

                elif msg_type == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": time.time()}))
            except Exception as e:
                logger.debug(f"Error parsing WebSocket incoming message: {e}")

    send_task = asyncio.create_task(send_events())
    recv_task = asyncio.create_task(receive_messages())

    try:
        done, pending = await asyncio.wait(
            [send_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WebSocket closed: {e}")
    finally:
        broadcaster.unsubscribe(listener)
        send_task.cancel()
        recv_task.cancel()
