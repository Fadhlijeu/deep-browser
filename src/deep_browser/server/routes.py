"""
REST API routes for tasks, browser sessions, extension handoffs, and workspace data.
"""

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from deep_browser.agent.core import DeepBrowserAgent
from deep_browser.browser.runtime import browser_manager
from deep_browser.config import settings
from deep_browser.models.task import Task
from deep_browser.server.ws import ws_manager

router = APIRouter()

# In-memory registry of active agents and tasks
active_tasks: Dict[str, Task] = {}
active_agents: Dict[str, DeepBrowserAgent] = {}


class CreateTaskRequest(BaseModel):
    goal: str
    browser_mode: Optional[str] = None
    profile_id: Optional[str] = "default"


class TabHandoffRequest(BaseModel):
    tab_id: int
    url: str
    title: str


@router.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "service": "Deep-Browser"}


@router.post("/api/tasks")
async def create_task(req: CreateTaskRequest):
    """Create and spawn a new browser agent task."""
    task = Task(
        goal=req.goal,
        browser_mode=req.browser_mode or settings.default_browser_mode,
        profile_id=req.profile_id or "default",
    )
    active_tasks[task.id] = task

    def event_broadcaster(evt: str, data: Dict[str, Any]):
        asyncio.create_task(ws_manager.broadcast(evt, data))

    agent = DeepBrowserAgent(task=task, on_event=event_broadcaster)
    active_agents[task.id] = agent

    # Run agent in background task
    asyncio.create_task(agent.run())

    return {"status": "created", "task": task.model_dump()}


@router.get("/api/tasks")
async def list_tasks():
    """List all active tasks."""
    return {"tasks": [t.model_dump() for t in active_tasks.values()]}


@router.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": active_tasks[task_id].model_dump()}


@router.post("/api/tasks/{task_id}/confirm")
async def confirm_task_action(task_id: str):
    """User approved pending sensitive action; resume agent."""
    if task_id not in active_agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent = active_agents[task_id]
    agent.confirm_action()
    asyncio.create_task(agent.run())
    return {"status": "resumed", "task_id": task_id}


@router.post("/api/tasks/{task_id}/pause")
async def pause_task(task_id: str):
    if task_id not in active_agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    active_agents[task_id].pause()
    return {"status": "paused", "task_id": task_id}


@router.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    if task_id not in active_agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    active_agents[task_id].cancel()
    return {"status": "cancelled", "task_id": task_id}


@router.get("/api/sessions")
async def list_sessions():
    """List active browser sessions."""
    sessions = await browser_manager.list_active_sessions()
    return {"sessions": sessions}


@router.post("/api/extension/handoff")
async def handoff_tab(req: TabHandoffRequest):
    """Chrome Extension handoff: start a task on the user's active Chrome tab."""
    goal = f"Interact with the current active tab: {req.title} ({req.url})"
    task = Task(goal=goal, browser_mode="attached", profile_id="attached_user")
    active_tasks[task.id] = task

    def event_broadcaster(evt: str, data: Dict[str, Any]):
        asyncio.create_task(ws_manager.broadcast(evt, data))

    agent = DeepBrowserAgent(task=task, on_event=event_broadcaster)
    active_agents[task.id] = agent

    asyncio.create_task(agent.run())
    return {"status": "attached_task_started", "task_id": task.id, "url": req.url}


@router.get("/api/workspace/artifacts")
async def list_artifacts():
    """List generated artifacts in workspace."""
    artifact_dir = settings.workspace_dir / "artifacts"
    files = []
    if artifact_dir.exists():
        for p in artifact_dir.glob("*.*"):
            files.append({"name": p.name, "size": p.stat().st_size, "path": str(p)})
    return {"artifacts": files}
