"""
Deep-Browser Agent: Supervisory reasoning loop with deterministic verification.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from deep_browser.agent.prompts import SYSTEM_PROMPT
from deep_browser.browser.runtime import browser_manager
from deep_browser.browser.session import BrowserSession
from deep_browser.config import settings
from deep_browser.dom.service import DOMService
from deep_browser.llm.router import model_router
from deep_browser.models.action import ActionCall, ActionReceipt, VerificationResult
from deep_browser.models.task import Milestone, Task
from deep_browser.tools.controller import tool_controller
from deep_browser.verification.engine import verification_engine

logger = logging.getLogger(__name__)


class DeepBrowserAgent:
    """Autonomous supervisory browser agent."""

    def __init__(
        self,
        task: Task,
        on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ):
        self.task = task
        self.on_event = on_event
        self.session: Optional[BrowserSession] = None
        self._is_paused = False
        self._is_cancelled = False

    async def run(self) -> Task:
        """Run agent loop until completion, failure, or pause."""
        logger.info(f"Starting agent run for task {self.task.id}: '{self.task.goal}'")
        self.task.status = "running"
        self._emit_event("TASK_STARTED", {"task": self.task.model_dump()})

        try:
            # 1. Provision or attach browser session
            self.session = await browser_manager.get_or_create_session(
                session_id=self.task.session_id or f"sess_{self.task.id}",
                profile_id=self.task.profile_id,
                mode=self.task.browser_mode,
            )
            self.task.session_id = self.session.session_id

            # 2. Main reasoning and execution loop
            step_count = 0
            while (
                self.task.status in ["running", "verifying", "recovering"]
                and step_count < settings.max_steps_per_task
                and not self._is_cancelled
            ):
                if self._is_paused:
                    self.task.status = "paused"
                    self._emit_event("TASK_PAUSED", {"task": self.task.model_dump()})
                    break

                step_count += 1
                logger.info(f"--- Task {self.task.id} Step {step_count} ---")

                # Step Phase A: OBSERVE
                pre_snapshot = await DOMService.extract_dom_snapshot(self.session)
                pre_state = {"url": pre_snapshot.url, "title": pre_snapshot.title}

                # Step Phase B: THINK
                prompt = self._build_turn_prompt(pre_snapshot, step_count)
                provider = model_router.get_provider()
                llm_res = await provider.generate_action(SYSTEM_PROMPT, prompt)

                # Accumulate token usage
                self.task.token_usage.prompt_tokens += llm_res.token_usage.prompt_tokens
                self.task.token_usage.completion_tokens += llm_res.token_usage.completion_tokens
                self.task.token_usage.total_tokens += llm_res.token_usage.total_tokens
                self.task.token_usage.llm_calls += 1

                parsed = llm_res.parsed_json or {}
                thought = parsed.get("thought", "Analyzing browser view...")
                action_data = parsed.get("action", {})
                tool_name = action_data.get("tool", "scroll")
                params = action_data.get("params", {})
                expected_consequence = action_data.get("expected_consequence", "")
                is_sensitive = bool(action_data.get("is_sensitive", False))

                # Update milestones if provided
                if "milestone_plan" in parsed and isinstance(parsed["milestone_plan"], list):
                    self._update_milestones(parsed["milestone_plan"])

                action_call = ActionCall(
                    tool=tool_name,
                    params=params,
                    thought=thought,
                    expected_consequence=expected_consequence,
                    is_sensitive=is_sensitive,
                )

                self._emit_event(
                    "STEP_PLANNED",
                    {
                        "task_id": self.task.id,
                        "step": step_count,
                        "thought": thought,
                        "action": action_call.model_dump(),
                    },
                )

                # Step Phase C: SAFE CHECK (Human confirmation)
                if is_sensitive and settings.safe_mode:
                    self.task.status = "waiting_confirmation"
                    self.task.pending_confirmation_action = action_call.model_dump()
                    self._emit_event("CONFIRMATION_REQUIRED", {"task": self.task.model_dump()})
                    logger.info(f"Task {self.task.id} paused for user confirmation on sensitive action {tool_name}")
                    return self.task

                # Check if task is completed
                if tool_name == "complete_task":
                    summary = str(params.get("summary", "Task finished successfully"))
                    self.task.status = "completed"
                    self.task.result_summary = summary
                    self._emit_event("TASK_COMPLETED", {"task": self.task.model_dump()})
                    break

                # Step Phase D: ACT
                exec_success = True
                exec_output = None
                try:
                    exec_output = await tool_controller.execute(self.session, action_call)
                except Exception as e:
                    exec_success = False
                    exec_output = str(e)
                    logger.error(f"Action execution error: {e}")

                # Capture verification screenshot
                screenshot_filename = f"{self.task.id}_step{step_count}_{tool_name}.webp"
                screenshot_path = settings.workspace_dir / "screenshots" / screenshot_filename
                try:
                    await self.session.capture_screenshot(screenshot_path)
                except Exception as e:
                    logger.warning(f"Screenshot capture failed: {e}")

                # Step Phase E: VERIFY
                verification = await verification_engine.verify_action(self.session, action_call, pre_state)

                receipt = ActionReceipt(
                    step_index=step_count,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    action=action_call,
                    execution_success=exec_success,
                    execution_output=exec_output,
                    verification=verification,
                    screenshot_path=str(screenshot_path.relative_to(settings.workspace_dir.parent)),
                    page_url=self.session.current_url,
                    page_title=self.session.current_title,
                )
                self.task.history.append(receipt)
                self.task.update_timestamp()

                self._emit_event(
                    "ACTION_RECEIPT",
                    {
                        "task_id": self.task.id,
                        "step": step_count,
                        "receipt": receipt.model_dump(),
                    },
                )

                # Step Phase F: COMMIT or RECOVER
                if verification.is_verified:
                    self.task.retry_count = 0
                else:
                    self.task.retry_count += 1
                    logger.warning(
                        f"Action verification failed for step {step_count}. "
                        f"Retry count: {self.task.retry_count}/{self.task.max_retries}"
                    )
                    if self.task.retry_count >= self.task.max_retries:
                        self.task.status = "failed"
                        self.task.error_message = f"Max retries exceeded on step {step_count}: {verification.error_message}"
                        self._emit_event("TASK_FAILED", {"task": self.task.model_dump()})
                        break

            if step_count >= settings.max_steps_per_task and self.task.status == "running":
                self.task.status = "failed"
                self.task.error_message = f"Reached maximum allowed steps ({settings.max_steps_per_task})"
                self._emit_event("TASK_FAILED", {"task": self.task.model_dump()})

        except Exception as e:
            logger.error(f"Fatal error in agent run: {e}", exc_info=True)
            self.task.status = "failed"
            self.task.error_message = str(e)
            self._emit_event("TASK_FAILED", {"task": self.task.model_dump()})

        self._save_task_checkpoint()
        return self.task

    def confirm_action(self) -> None:
        """User approved pending sensitive action; resume execution."""
        if self.task.status == "waiting_confirmation":
            self.task.status = "running"
            self.task.pending_confirmation_action = None

    def pause(self) -> None:
        """Pause agent execution."""
        self._is_paused = True

    def cancel(self) -> None:
        """Cancel agent execution."""
        self._is_cancelled = True
        self.task.status = "cancelled"
        self._emit_event("TASK_CANCELLED", {"task": self.task.model_dump()})

    def _build_turn_prompt(self, snapshot: Any, step_idx: int) -> str:
        """Assemble structured prompt with current DOM context and history."""
        recent_history = []
        for r in self.task.history[-4:]:
            recent_history.append(
                f"- Step {r.step_index}: Tool={r.action.tool}, Status={r.verification.status}, URL={r.page_url}"
            )
        history_text = "\n".join(recent_history) if recent_history else "No previous actions yet."

        return f"""USER GOAL: {self.task.goal}

CURRENT BROWSER STATE:
URL: {snapshot.url}
Title: {snapshot.title}

INTERACTIVE ELEMENTS ON CURRENT PAGE:
{snapshot.element_tree_text or 'No interactive elements detected.'}

RECENT ACTION HISTORY:
{history_text}

STEP NUMBER: {step_idx}
Please decide the next best action to advance toward the user goal.
"""

    def _update_milestones(self, raw_milestones: List[Dict[str, Any]]) -> None:
        """Update task milestone graph."""
        existing_titles = {m.title: m for m in self.task.milestones}
        for item in raw_milestones:
            title = item.get("title", "")
            status = item.get("status", "pending")
            if title in existing_titles:
                existing_titles[title].status = status
            elif title:
                self.task.milestones.append(Milestone(title=title, status=status))

    def _save_task_checkpoint(self) -> None:
        """Serialize task state to local workspace directory."""
        path = settings.workspace_dir / "tasks" / f"{self.task.id}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.task.model_dump(), f, indent=2)

    def _emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Emit real-time WebSocket event if listener registered."""
        if self.on_event:
            try:
                self.on_event(event_type, data)
            except Exception as e:
                logger.error(f"Error emitting event {event_type}: {e}")
