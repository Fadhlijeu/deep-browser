"""
FastAPI + WebSocket companion bridge server connecting Chrome Extension MV3
directly to the root browser_use agent core with Safe Mode confirmation gateways.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from browser_use import Agent, BrowserProfile, BrowserSession, Tools
from browser_use.llm import ChatGoogle, ChatOpenAI, ChatAnthropic, ChatOllama
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType
from deep_browser.policies.safety import SafeModeManager, SafeModePolicy, SafeTools
from deep_browser.sessions.coordinator import MultiBrowserCoordinator
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
coordinator = MultiBrowserCoordinator()
workspace = WorkspaceManager()
verification = VerificationEngine()
safe_manager = SafeModeManager.get_instance()

# Active tasks state
active_agents: Dict[str, Agent] = {}
active_tasks: Dict[str, Dict[str, Any]] = {}


class CreateTaskRequest(BaseModel):
    task: str
    model_provider: str = Field(default="gemini", description="gemini, openai, anthropic, or ollama")
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    attached_mode: bool = False
    cdp_port: int = 9222
    headless: bool = False
    safe_mode: bool = True
    safe_timeout_seconds: float = 60.0


class ConfirmationDecisionRequest(BaseModel):
    decision: str = Field(description="CONFIRM or REJECT")


def _create_llm(provider: str, model_name: Optional[str], api_key: Optional[str]):
    provider = provider.lower()
    if provider == "gemini":
        model = model_name or "gemini-2.5-flash"
        return ChatGoogle(model=model, api_key=api_key)
    elif provider == "openai":
        model = model_name or "gpt-4o"
        return ChatOpenAI(model=model, api_key=api_key)
    elif provider == "anthropic":
        model = model_name or "claude-3-5-sonnet-20241022"
        return ChatAnthropic(model=model, api_key=api_key)
    elif provider == "ollama":
        model = model_name or "qwen2.5:7b"
        return ChatOllama(model=model)
    else:
        # Default fallback to Google Gemini
        return ChatGoogle(model=model_name or "gemini-2.5-flash", api_key=api_key)


@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "app": "deep-browser",
        "version": "0.13.8",
        "active_tasks": len(active_tasks),
        "active_sessions": len(coordinator.list_active_sessions()),
    }


@app.get("/api/sessions")
async def list_sessions():
    return {"sessions": coordinator.list_active_sessions()}


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
    import time
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
        session_id = f"session_{task_id}"
        session = await coordinator.create_session(
            session_id=session_id,
            attached_mode=req.attached_mode,
            cdp_port=req.cdp_port,
            headless=req.headless,
        )

        llm = _create_llm(req.model_provider, req.model_name, req.api_key)
        
        # Instantiate SafeTools directly over Browser Use Tools
        policy = SafeModePolicy(enabled=req.safe_mode, timeout_seconds=req.safe_timeout_seconds)
        tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

        agent = Agent(
            task=req.task,
            llm=llm,
            browser_session=session,
            tools=tools,
        )
        active_agents[task_id] = agent

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                event_type=EventType.TASK_STARTED,
                message="Agent execution started",
            )
        )

        # Run agent
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
                session_id=session_id,
                event_type=EventType.FAILED,
                message=f"Task failed: {e}",
                data={"error": str(e)},
            )
        )
    finally:
        active_agents.pop(task_id, None)


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
            event_type=EventType.FAILED,
            message="Task stopped by user",
        )
    )
    return {"status": "stopped"}


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
