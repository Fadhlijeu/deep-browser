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
from deep_browser.bridge.extension_runner import (
    ExtensionTaskContext,
    CdpBridgeProxy,
    get_or_create_cdp_bridge,
    get_cdp_bridge,
    remove_cdp_bridge,
    register_extension_task,
    get_extension_task,
    list_extension_tasks,
    remove_extension_task,
    build_extension_context_prompt,
    map_action_to_event,
)

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

from deep_browser.bridge.extension_session import (
    ExtensionBrowserSession,
    ExtensionTransport,
    get_or_create_extension_transport,
    get_extension_transport,
    remove_extension_transport,
)



class CreateTaskRequest(BaseModel):
    task: str
    session_id: Optional[str] = None
    session_type: str = Field(default="EXTENSION", description="EXTENSION or WORKSPACE")
    owner: str = Field(default="EXTENSION", description="WORKSPACE or EXTENSION")
    browser_mode: str = Field(default="ATTACHED", description="ATTACHED (user's current Chrome/Edge) or MANAGED")
    browser_type: str = Field(default="chrome", description="chrome, edge, brave, or bundled")
    browser_id: Optional[str] = "chrome_9222"
    tab_id: Optional[Union[str, int]] = None
    window_id: Optional[Union[str, int]] = None
    url: Optional[str] = None
    title: Optional[str] = None
    model_provider: str = Field(default="gemini", description="gemini, openai, anthropic, or ollama")
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    attached_mode: bool = True
    cdp_port: int = 9222
    headless: bool = False
    safe_mode: bool = True
    safe_timeout_seconds: float = 60.0
    challenge_timeout_seconds: float = 60.0


class HandoffRequest(BaseModel):
    session_id: Optional[str] = None
    to_owner: str = "WORKSPACE"


class AttachChromeRequest(BaseModel):
    name: str = "Current Chrome"
    cdp_port: int = 9222
    cdp_url: Optional[str] = None
    owner: str = "EXTENSION"


class CreateManagedSessionRequest(BaseModel):
    name: str = "Managed Session"
    headless: bool = False
    user_data_dir: Optional[str] = None
    profile_directory: Optional[str] = None
    owner: str = "EXTENSION"


class ConfirmationDecisionRequest(BaseModel):
    decision: str = Field(description="CONFIRM or REJECT")


def _create_llm(provider: str, model_name: Optional[str], api_key: Optional[str]):
    """
    Build an LLM instance for any supported provider.
    Provider is sent by the Extension along with the user-configured API key.
    """
    import os
    provider = (provider or "gemini").lower().strip()

    if provider in ("gemini", "google"):
        model = model_name or os.environ.get("GEMINI_MODEL") or "gemini-2.0-flash"
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        return ChatGoogle(model=model, api_key=key)

    elif provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            raise RuntimeError("langchain-openai not installed. Run: pip install langchain-openai")
        model = model_name or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"
        key = api_key or os.environ.get("OPENAI_API_KEY")
        return ChatOpenAI(model=model, api_key=key)

    elif provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise RuntimeError("langchain-anthropic not installed. Run: pip install langchain-anthropic")
        model = model_name or os.environ.get("ANTHROPIC_MODEL") or "claude-3-5-haiku-20241022"
        key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        return ChatAnthropic(model=model, api_key=key)  # type: ignore[call-arg]

    elif provider in ("ollama", "local"):
        try:
            from langchain_ollama import ChatOllama
        except ImportError:
            raise RuntimeError("langchain-ollama not installed. Run: pip install langchain-ollama")
        model = model_name or os.environ.get("OLLAMA_MODEL") or "llama3"
        base_url = api_key or os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
        return ChatOllama(model=model, base_url=base_url)

    elif provider in ("custom_openai", "custom", "deepseek"):
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            raise RuntimeError("langchain-openai not installed. Run: pip install langchain-openai")
        model = model_name or "deepseek-chat"
        # For custom_openai, api_key may be "sk-xxx" and baseUrl is stored separately.
        # The Extension must pass the API key; base_url comes from model config via api_key field convention.
        key = api_key or os.environ.get("CUSTOM_OPENAI_API_KEY")
        base_url = os.environ.get("CUSTOM_OPENAI_BASE_URL") or "https://api.deepseek.com/v1"
        return ChatOpenAI(model=model, api_key=key, base_url=base_url)

    else:
        logger.warning(f"Unknown provider '{provider}', falling back to Gemini Flash.")
        model = model_name or "gemini-2.0-flash"
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        return ChatGoogle(model=model, api_key=key)


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
async def list_sessions(owner: Optional[str] = "EXTENSION"):
    views = await coordinator.list_session_views(owner=owner)
    return {
        "sessions": [v.model_dump() for v in views],
        "active_session_id": coordinator.active_session_id,
    }


@app.post("/api/sessions/attach")
async def attach_chrome(req: AttachChromeRequest):
    try:
        view = await coordinator.attach_system_chrome(cdp_port=req.cdp_port, cdp_url=req.cdp_url, owner=req.owner)
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
            owner=req.owner,
        )
        return {"status": "success", "session": view.model_dump()}
    except Exception as e:
        logger.error(f"Error creating managed session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/handoff")
@app.post("/api/handoff")
async def handoff_session(session_id: Optional[str] = None, req: Optional[HandoffRequest] = None):
    target_sid = session_id or (req.session_id if req else None)
    if not target_sid:
        target_sid = coordinator.active_session_id
    if not target_sid:
        raise HTTPException(status_code=400, detail="No session_id specified for handoff")

    to_owner = req.to_owner if req and req.to_owner else "WORKSPACE"
    view = coordinator.handoff_session(target_sid, to_owner=to_owner)
    
    session_data = view.model_dump() if view else {
        "id": target_sid,
        "owner": to_owner,
        "origin": "EXTENSION" if to_owner == "WORKSPACE" else "WORKSPACE",
        "origin_session_id": target_sid,
        "tag": "ext" if to_owner == "WORKSPACE" else None,
        "handoff_state": "HANDED_OFF",
    }

    # Broadcast explicit handoff event
    await broadcaster.broadcast(
        DeepBrowserEvent(
            task_id=f"handoff_{target_sid}",
            session_id=target_sid,
            owner=to_owner,
            origin="EXTENSION",
            tag="ext",
            event_type=EventType.SESSION_HANDOFF_COMPLETED,
            message=f"Session {target_sid} handed off to {to_owner}",
            data={"session": session_data},
        )
    )

    return {
        "status": "success",
        "message": f"Session {target_sid} handed off to {to_owner}",
        "session": session_data,
    }


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
    is_extension = (req.owner == "EXTENSION") or (req.session_type == "EXTENSION")
    owner = "EXTENSION" if is_extension else "WORKSPACE"
    is_attached = (req.browser_mode.upper() == "ATTACHED") or req.attached_mode or is_extension
    browser_mode = "ATTACHED" if is_attached else "MANAGED"
    browser_id = req.browser_id or ("chrome_9222" if is_attached else "bundled_chromium")
    
    # CRITICAL: Extension tasks MUST NEVER inherit coordinator.active_session_id
    if is_extension:
        session_id = req.session_id or f"EXT-{int(time.time() * 1000) % 10000:04d}"
    else:
        session_id = req.session_id or coordinator.active_session_id or f"WS-{int(time.time() * 1000) % 10000:04d}"

    active_tasks[task_id] = {
        "id": task_id,
        "task": req.task,
        "session_id": session_id,
        "owner": owner,
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
            session_id=session_id,
            owner=owner,
            browser_mode=browser_mode,
            browser_id=browser_id,
            tab_id=req.tab_id,
            event_type=EventType.TASK_CREATED,
            message=f"Task created: {req.task}",
            data={"task": req.task, "browser_mode": browser_mode, "browser_id": browser_id, "safe_mode": req.safe_mode},
        )
    )

    # Route to correct execution pipeline
    if is_extension:
        # Pre-allocate ExtensionTransport queues BEFORE returning HTTP response
        # so Extension can immediately connect WebSocket without race condition.
        get_or_create_extension_transport(task_id)
        asyncio.create_task(_run_extension_task_background(task_id, req, session_id))
    else:
        asyncio.create_task(_run_task_background(task_id, req, session_id))

    return {
        "task_id": task_id,
        "status": "created",
        "session_id": session_id,
        "owner": owner,
        "browser_mode": browser_mode,
        "browser_id": browser_id,
        "tab_id": req.tab_id,
    }


async def _run_extension_task_background(task_id: str, req: CreateTaskRequest, session_id: str):
    """
    Extension execution path using the genuine Browser Use Agent + ExtensionBrowserSession adapter.

    Architecture:
      Browser Use Agent (browser_use.agent.service.Agent)
          ↓
      SafeTools Registry (browser_use.tools.Tools)
          ↓ Events (NavigateToUrlEvent, ClickElementEvent, TypeTextEvent, etc.)
      ExtensionBrowserSession (BrowserSession subclass)
          ↓ Commands (GET_STATE, NAVIGATE, CLICK, TYPE, SCROLL)
      ExtensionTransport (WebSocket Relay)
          ↓
      Chrome Extension (sidepanel.js on active tab)

    INVARIANTS:
    - coordinator.active_session_id is NEVER read
    - coordinator.attach_system_chrome() is NEVER called
    - No duplicate Agent loop — uses genuine browser_use.Agent
    - Isolated from Workspace sessions
    """
    from deep_browser.bridge.extension_runner import ExtensionTaskContext, register_extension_task

    owner = "EXTENSION"
    browser_mode = "EXTENSION_NATIVE"
    browser_id = f"ext_tab_{req.tab_id or 'current'}"
    tab_id = req.tab_id

    ext_ctx = ExtensionTaskContext(
        id=session_id,
        task_id=task_id,
        task=req.task,
        tab_id=req.tab_id,
        window_id=req.window_id,
        url=req.url,
        title=req.title,
        model=req.model_name or "gemini-2.0-flash",
        status="running",
    )
    register_extension_task(ext_ctx)

    transport = get_or_create_extension_transport(task_id)

    try:
        active_tasks[task_id]["status"] = "running"

        # Wait for Extension WS transport handshake
        connected = await transport.wait_connected(timeout=20.0)
        if not connected:
            raise RuntimeError(
                "Extension WebSocket transport did not connect within 20s. "
                "Make sure the Deep-Browser Extension sidepanel is open."
            )

        logger.info(f"[ExtensionSession] Starting genuine Browser Use Agent for task {task_id}")

        # 1. Build ExtensionBrowserSession (implements BrowserSession interface)
        session = ExtensionBrowserSession(
            transport=transport,
            initial_url=req.url,
            initial_title=req.title,
            initial_tab_id=req.tab_id,
        )

        # 2. Build LLM and Tools
        llm = _create_llm(req.model_provider, req.model_name, req.api_key)
        policy = SafeModePolicy(enabled=req.safe_mode, timeout_seconds=req.safe_timeout_seconds)
        tools = SafeTools(safe_policy=policy, broadcaster=broadcaster)

        # 3. Step callback for timeline broadcast to presentation UI
        async def step_callback(state_summary, agent_output, step_num):
            url = getattr(state_summary, "url", "") or req.url or ""
            title = getattr(state_summary, "title", "") or req.title or ""
            thinking = getattr(agent_output.current_state, "thinking", None) if agent_output else None
            next_goal = getattr(agent_output.current_state, "next_goal", None) if agent_output else None

            await broadcaster.broadcast(
                DeepBrowserEvent(
                    task_id=task_id,
                    session_id=session_id,
                    owner=owner,
                    browser_mode=browser_mode,
                    browser_id=browser_id,
                    tab_id=tab_id,
                    event_type=EventType.OBSERVATION,
                    status="OBSERVED",
                    summary=f"Observing: {title or url or 'current tab'}",
                    message=f"Step {step_num}: {url}",
                    data={"step": step_num, "url": url, "title": title, "thought": thinking, "next_goal": next_goal},
                )
            )

            if thinking:
                await broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=task_id,
                        session_id=session_id,
                        owner=owner,
                        browser_mode=browser_mode,
                        browser_id=browser_id,
                        tab_id=tab_id,
                        event_type=EventType.REASONING,
                        status="THINKING",
                        summary="Reasoning...",
                        message=str(thinking),
                        data={"thinking": thinking, "next_goal": next_goal},
                    )
                )

            # Broadcast individual actions from agent_output
            if agent_output and getattr(agent_output, "action", None):
                for act in agent_output.action:
                    act_dump = act.model_dump(exclude_unset=True) if hasattr(act, "model_dump") else {}
                    for act_name, act_params in act_dump.items():
                        target_str = ""
                        evt_type = EventType.ACTION_REQUESTED
                        if act_name == "navigate" or act_name == "go_to_url":
                            evt_type = EventType.NAVIGATION
                            target_str = act_params.get("url", "") if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "click_element" or act_name == "click":
                            evt_type = EventType.CLICK
                            target_str = f"Element #{act_params.get('index', '')}" if isinstance(act_params, dict) else str(act_params)
                        elif act_name in ("input_text", "type_text", "type"):
                            evt_type = EventType.TYPE
                            text = act_params.get("text", "") if isinstance(act_params, dict) else str(act_params)
                            target_str = text[:80]
                        elif act_name == "scroll_page" or act_name == "scroll":
                            evt_type = EventType.SCROLL
                            target_str = str(act_params)
                        elif act_name in ("press_key", "key_press", "send_keys"):
                            evt_type = EventType.PRESS_KEY
                            target_str = act_params.get("key", "") if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "switch_tab":
                            evt_type = EventType.TAB_SWITCH
                            target_str = str(act_params)

                        if evt_type != EventType.ACTION_REQUESTED:
                            await broadcaster.broadcast(
                                DeepBrowserEvent(
                                    task_id=task_id,
                                    session_id=session_id,
                                    owner=owner,
                                    browser_mode=browser_mode,
                                    browser_id=browser_id,
                                    tab_id=tab_id,
                                    event_type=evt_type,
                                    action=act_name,
                                    target=target_str,
                                    status="EXECUTING",
                                    summary=f"{act_name}: {target_str}",
                                    message=target_str,
                                    data=act_params if isinstance(act_params, dict) else {},
                                )
                            )


        # 4. Domain & operational guidance for autonomous agent
        system_extension_prompt = (
            "Deep-Browser Autonomous Agent Guidelines:\n"
            "1. DETAIL COMPLETION & PROFILE VERIFICATION: When looking up specific records, profiles, students, or lecturers (e.g. on PDDikti or databases), NEVER conclude at the search result table/list. Click into the specific record, wait for the profile/detail page to load, and verify the full data before declaring the task done.\n"
            "2. SCREENSHOT EVIDENCE: If the user asks for a screenshot or visual proof, ensure you have navigated to the final target page, scrolled the relevant information clearly into view, and taken the screenshot of the actual rendered content.\n"
            "3. RESEARCH ACCURACY: For scientific, historical, or academic research, search and open authoritative, encyclopedic, or published sources (e.g. Wikipedia, scientific papers, official registries). Do not rely on commercial AI landing pages or promotional ads.\n"
            "4. MULTI-TAB RESEARCH: When tasked with multi-tab or parallel research across topics, open new tabs using navigate(..., new_tab=True), inspect and extract key findings from each, and synthesize a comprehensive markdown summary.\n"
            "5. OUTPUT FORMAT: Present your final result as structured, clean Markdown with clear headings, bullet points, and citations."
        )

        # 5. Instantiate genuine Browser Use Agent
        agent = Agent(
            task=req.task,
            llm=llm,
            browser_session=session,
            tools=tools,
            register_new_step_callback=step_callback,
            extend_system_message=system_extension_prompt,
            enable_planning=True,
            use_vision=True,
        )

        active_agents[task_id] = agent

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=owner,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.TASK_STARTED,
                message="Browser Use Agent reasoning started on current tab",
            )
        )

        # 5. Run genuine Browser Use agent loop
        result = await agent.run()

        ext_ctx.status = "completed"
        active_tasks[task_id]["status"] = "completed"
        active_tasks[task_id]["result"] = str(result)

        result_text = str(result) if result is not None else "Task completed."
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=owner,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.TASK_COMPLETED,
                message="Task completed successfully",
                data={"result": result_text},
            )
        )

    except Exception as e:
        logger.error(f"Extension task {task_id} failed: {e}", exc_info=True)
        err_msg = str(e)
        ext_ctx.status = "failed"
        if task_id in active_tasks:
            active_tasks[task_id]["status"] = "failed"
            active_tasks[task_id]["error"] = err_msg
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=owner,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.ERROR,
                message=f"Extension task failed: {err_msg}",
                data={"error": err_msg},
            )
        )
    finally:
        active_agents.pop(task_id, None)
        remove_extension_transport(task_id)



async def _run_task_background(task_id: str, req: CreateTaskRequest, session_id: str):
    """
    Workspace execution path — uses BrowserSession, BrowserProfile, coordinator.
    This path is ONLY reached when owner == 'WORKSPACE'.
    """
    agent = None
    is_attached = (req.browser_mode.upper() == "ATTACHED") or req.attached_mode
    browser_mode = "ATTACHED" if is_attached else "MANAGED"
    browser_id = req.browser_id or ("chrome_9222" if is_attached else "bundled_chromium")
    tab_id = req.tab_id

    try:
        session = None
        if session_id:
            session = coordinator.get_session(session_id)

        if not session:
            if is_attached:
                view = await coordinator.attach_system_chrome(
                    session_id=session_id, cdp_port=req.cdp_port,
                    browser_type=req.browser_type, owner="WORKSPACE"
                )
                session_id = view.id
                session = coordinator.get_session(session_id)
            else:
                view = await coordinator.create_managed_session(headless=req.headless, owner="WORKSPACE")
                session_id = view.id
                session = coordinator.get_session(session_id)

        assert session is not None, "Failed to initialize BrowserSession"

        # 1. Broadcast CONTEXT_ATTACHED event
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=req.owner,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=EventType.CONTEXT_ATTACHED,
                status="ATTACHED",
                summary=f"Attached to current tab: {req.title or req.url or 'Active Tab'}",
                message=f"Direct tab attachment confirmed ({req.url or 'current tab'})",
                data={"url": req.url, "title": req.title, "tab_id": tab_id, "window_id": req.window_id},
            )
        )

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
                    owner=req.owner,
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

            # Broadcast THINKING_STATUS if thinking is available
            if thinking:
                await broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=task_id,
                        session_id=session_id,
                        owner=req.owner,
                        browser_mode=browser_mode,
                        browser_id=browser_id,
                        tab_id=tab_id,
                        event_type=EventType.THINKING_STATUS,
                        status="THINKING",
                        summary="Analyzing page context...",
                        message=str(thinking)[:200],
                        data={"thinking": thinking},
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
                        owner=req.owner,
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

                # Watchdog polling loop on the SAME tab
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
                                    owner=req.owner,
                                    browser_mode=browser_mode,
                                    browser_id=browser_id,
                                    tab_id=tab_id,
                                    event_type=EventType.CHALLENGE_RESOLVED,
                                    status="RESUMED",
                                    summary="Verification resolved. Resuming task...",
                                    message="Verification resolved on current tab. Resuming execution.",
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
                            owner=req.owner,
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
                        elif act_name == "press_key" or act_name == "key_press":
                            evt_type = EventType.PRESS_KEY
                            target_str = act_params.get("key", "") if isinstance(act_params, dict) else str(act_params)
                        elif act_name == "switch_tab":
                            evt_type = EventType.TAB_SWITCH
                            target_str = str(act_params)

                        await broadcaster.broadcast(
                            DeepBrowserEvent(
                                task_id=task_id,
                                session_id=session_id,
                                owner=req.owner,
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

        # Prepare initial context prompt for current tab
        if req.url or req.title:
            effective_task = f"""[CURRENT ACTIVE TAB CONTEXT]
URL: {req.url or 'about:blank'}
Title: {req.title or 'Active Tab'}
Tab ID: {req.tab_id or 'Current'}

User Task: {req.task}

IMPORTANT INSTRUCTIONS:
- You are operating directly on the user's active Chrome/Edge tab.
- The target page is ALREADY OPEN at {req.url or 'the current URL'}.
- Do NOT search for this website or navigate away unless explicitly requested.
- Perform the user's task directly on this page."""
        else:
            effective_task = req.task

        agent = Agent(
            task=effective_task,
            llm=llm,
            browser_session=session,
            tools=tools,
            register_new_step_callback=step_callback,
            extend_system_message=system_extension_prompt,
            enable_planning=True,
            use_vision=True,
        )

        active_agents[task_id] = agent
        coordinator.set_active_agent(agent, task_id)

        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=req.owner,
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
                    # Filter: Extension WS only sees Extension events, Workspace events are separate
                    if event.owner == "EXTENSION":
                        await websocket.send_text(json.dumps(event.model_dump(), default=str))

            except asyncio.CancelledError:
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await broadcaster.unregister_client(queue)


# --- CDP Bridge WebSocket (chrome.debugger ↔ BrowserSession proxy) ---

@app.websocket("/ws/cdp-bridge/{task_id}")
async def cdp_bridge_ws_endpoint(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for Extension JS chrome.debugger CDP bridge.
    
    Flow:
    1. Extension JS attaches chrome.debugger to current tab
    2. Extension JS connects here, bridging CDP messages
    3. Backend's BrowserSession uses this as its CDP endpoint
    
    Message format (Extension → Backend):
    { "type": "CDP_RESPONSE" | "CDP_EVENT", "payload": <raw CDP JSON> }
    
    Message format (Backend → Extension):
    { "type": "CDP_COMMAND", "payload": <raw CDP JSON command> }
    """
    await websocket.accept()
    cdp_bridge = get_or_create_cdp_bridge(task_id)
    cdp_bridge.set_extension_websocket(websocket)
    logger.info(f"[CDP Bridge] Extension JS connected for task {task_id}")

    try:
        while True:
            raw_msg = await websocket.receive_text()
            # Relay CDP response/event from Extension JS → BrowserSession
            await cdp_bridge.relay_from_extension(raw_msg)
    except WebSocketDisconnect:
        logger.info(f"[CDP Bridge] Extension JS disconnected for task {task_id}")
    except Exception as e:
        logger.error(f"[CDP Bridge] Error for task {task_id}: {e}")


# --- Extension Transport WebSocket (ExtensionBrowserSession ↔ Chrome Extension) ---

@app.websocket("/ws/ext-transport/{task_id}")
@app.websocket("/ws/ext-agent/{task_id}")
async def ext_transport_ws_endpoint(websocket: WebSocket, task_id: str):
    """
    Pure transport layer connecting ExtensionBrowserSession to the Chrome Extension.

    Relays:
      - Backend commands (GET_STATE, NAVIGATE, CLICK, TYPE, SCROLL, etc.) → Extension JS
      - Extension results / DOM snapshots → ExtensionBrowserSession
    """
    await websocket.accept()
    logger.info(f"[ExtTransport WS] Extension connected for task {task_id}")

    transport = get_or_create_extension_transport(task_id)
    transport.mark_connected()

    async def pump_to_extension():
        """Relay commands from ExtensionBrowserSession to Extension JS."""
        try:
            while not transport._closed:
                msg = await transport.send_queue.get()
                await websocket.send_text(json.dumps(msg, default=str))
        except Exception:
            pass

    async def pump_from_extension():
        """Relay responses from Extension JS to ExtensionBrowserSession."""
        try:
            while not transport._closed:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                await transport.push_incoming(msg)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"[ExtTransport WS] recv error task {task_id}: {e}")

    to_ext_task = asyncio.create_task(pump_to_extension())
    from_ext_task = asyncio.create_task(pump_from_extension())

    try:
        done, pending = await asyncio.wait(
            [to_ext_task, from_ext_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[ExtTransport WS] error task {task_id}: {e}")
    finally:
        logger.info(f"[ExtTransport WS] Extension disconnected for task {task_id}")




@app.get("/api/extension/tasks")
async def list_ext_tasks():
    """List all active Extension tasks (never touches coordinator/Workspace sessions)."""
    tasks = list_extension_tasks()
    return {
        "tasks": [
            {
                "id": t.id,
                "task_id": t.task_id,
                "task": t.task[:80],
                "tab_id": t.tab_id,
                "url": t.url,
                "title": t.title,
                "status": t.status,
                "created_at": t.created_at,
            }
            for t in tasks
        ]
    }


@app.get("/api/extension/tasks/{session_id}")
async def get_ext_task(session_id: str):
    """Get a specific Extension task context."""
    ctx = get_extension_task(session_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Extension task not found")
    return {
        "id": ctx.id,
        "task_id": ctx.task_id,
        "task": ctx.task,
        "tab_id": ctx.tab_id,
        "window_id": ctx.window_id,
        "url": ctx.url,
        "title": ctx.title,
        "model": ctx.model,
        "status": ctx.status,
        "created_at": ctx.created_at,
    }


# --- Workspace timeline WebSocket (separate from Extension) ---

@app.websocket("/ws/timeline")
async def workspace_timeline_ws_endpoint(websocket: WebSocket):
    """
    Workspace-only event timeline WebSocket.
    Receives ALL events (used by Desktop Workspace UI).
    """
    await websocket.accept()
    queue = await broadcaster.register_client()
    try:
        while True:
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
                    pass  # Workspace WS is read-only stream

                if broadcast_task in done:
                    event: DeepBrowserEvent = broadcast_task.result()
                    await websocket.send_text(json.dumps(event.model_dump(), default=str))

            except asyncio.CancelledError:
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Workspace timeline WS error: {e}")
    finally:
        await broadcaster.unregister_client(queue)

