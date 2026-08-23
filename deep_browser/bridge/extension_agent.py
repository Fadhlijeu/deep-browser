"""
ExtensionAgentLoop — Browser Use reasoning engine for Chrome Extension.

Architecture:
  Extension JS
    → chrome.scripting.executeScript()  [DOM extraction, action execution]
    → WebSocket /ws/ext-agent/{task_id}  [bidirectional command channel]

  Backend
    → ExtensionAgentLoop: receives DOM observations from Extension
    → Uses Browser Use LLM + agent prompts to plan actions
    → Sends structured action commands back to Extension
    → Extension executes: navigate, click, type, scroll, etc.
    → Loop until task complete

NO BrowserSession. NO CDP. NO port 9222. NO coordinator sessions.
All browser interaction happens inside the Extension JS context.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from deep_browser.events.models import DeepBrowserEvent, EventType

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
# DOM Extraction JS — injected by Extension into current tab
# Returns: { url, title, interactiveElements: [{index, tag, text, role, ...}], bodyText }
# ─────────────────────────────────────────────────────────────────
DOM_EXTRACTION_JS = """
(function() {
    function extractInteractive() {
        const selectors = [
            'a[href]', 'button', 'input:not([type="hidden"])', 'select',
            'textarea', '[role="button"]', '[role="link"]', '[role="menuitem"]',
            '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
            '[onclick]', '[tabindex]:not([tabindex="-1"])'
        ];
        const seen = new Set();
        const elements = [];
        let index = 0;
        document.querySelectorAll(selectors.join(',')).forEach(el => {
            if (seen.has(el)) return;
            seen.add(el);
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 120);
            elements.push({
                index: index++,
                tag: el.tagName.toLowerCase(),
                type: el.type || '',
                role: el.getAttribute('role') || '',
                text: text,
                href: el.href || '',
                name: el.name || '',
                id: el.id || '',
                placeholder: el.placeholder || '',
                value: (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') ? el.value : '',
                xpath: getXPath(el)
            });
        });
        return elements;
    }
    function getXPath(el) {
        if (el.id) return '//*[@id="' + el.id + '"]';
        const parts = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            let idx = 1;
            let sib = el.previousElementSibling;
            while (sib) { if (sib.tagName === el.tagName) idx++; sib = sib.previousElementSibling; }
            parts.unshift(el.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
            el = el.parentElement;
        }
        return '/' + parts.join('/');
    }
    return {
        url: location.href,
        title: document.title,
        bodyText: document.body ? document.body.innerText.slice(0, 8000) : '',
        interactiveElements: extractInteractive()
    };
})();
"""

# ─────────────────────────────────────────────────────────────────
# Action execution JS templates (injected by Extension)
# ─────────────────────────────────────────────────────────────────
ACTION_CLICK_JS = """
(function(xpath) {
    function getByXPath(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    const el = getByXPath(xpath);
    if (!el) return {success: false, error: 'Element not found: ' + xpath};
    el.scrollIntoView({behavior: 'instant', block: 'center'});
    el.focus();
    el.click();
    return {success: true};
})('%s');
"""

ACTION_TYPE_JS = """
(function(xpath, text) {
    function getByXPath(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    const el = getByXPath(xpath);
    if (!el) return {success: false, error: 'Element not found: ' + xpath};
    el.focus();
    el.value = '';
    el.dispatchEvent(new Event('input', {bubbles: true}));
    for (const char of text) {
        el.value += char;
        el.dispatchEvent(new InputEvent('input', {bubbles: true, data: char}));
    }
    el.dispatchEvent(new Event('change', {bubbles: true}));
    return {success: true};
})('%s', '%s');
"""

ACTION_SCROLL_JS = """
(function(direction, amount) {
    window.scrollBy(0, direction === 'down' ? amount : -amount);
    return {success: true};
})('%s', %d);
"""

ACTION_SELECT_OPTION_JS = """
(function(xpath, value) {
    function getByXPath(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    const el = getByXPath(xpath);
    if (!el) return {success: false, error: 'Element not found'};
    el.value = value;
    el.dispatchEvent(new Event('change', {bubbles: true}));
    return {success: true};
})('%s', '%s');
"""

# ─────────────────────────────────────────────────────────────────
# Extension Agent Loop — LLM reasoning over Extension DOM snapshots
# ─────────────────────────────────────────────────────────────────

@dataclass
class ExtAgentStep:
    step_num: int
    url: str
    title: str
    dom_summary: str
    thinking: str = ""
    actions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ExtensionAgentState:
    task_id: str
    session_id: str
    task: str
    url: str = ""
    title: str = ""
    step: int = 0
    status: str = "created"  # created|running|paused|completed|failed
    created_at: float = field(default_factory=time.time)
    history: List[ExtAgentStep] = field(default_factory=list)


def _build_agent_prompt(task: str, state: ExtensionAgentState, dom_snapshot: dict) -> str:
    """
    Build the reasoning prompt for the LLM.
    Uses the same action vocabulary as Browser Use.
    """
    url = dom_snapshot.get("url", "")
    title = dom_snapshot.get("title", "")
    body_text = dom_snapshot.get("bodyText", "")[:3000]
    elements = dom_snapshot.get("interactiveElements", [])

    # Format interactive elements list (same style as Browser Use)
    el_lines = []
    for el in elements[:80]:  # limit to 80 elements
        tag = el.get("tag", "")
        text = el.get("text", "") or el.get("placeholder", "") or el.get("value", "")
        href = el.get("href", "")
        role = el.get("role", "")
        idx = el.get("index", 0)
        desc = f"[{idx}] <{tag}"
        if role: desc += f" role={role}"
        if href: desc += f" href={href[:60]}"
        desc += f"> {text}"
        el_lines.append(desc)

    elements_str = "\n".join(el_lines) if el_lines else "(no interactive elements found)"

    # History summary
    history_str = ""
    for h in state.history[-3:]:  # last 3 steps
        history_str += f"\nStep {h.step_num} ({h.url}): {h.thinking[:200]}"
        for act in h.actions:
            history_str += f"\n  → {act.get('action')}: {str(act.get('params', ''))[:100]}"

    system_prompt = f"""You are a web automation agent operating through a Chrome Extension.
You observe the current browser tab and decide what actions to take to complete the task.
You CANNOT open new tabs or browsers. You work ONLY on the current tab.

Available actions (respond as JSON):
- navigate: {{"action": "navigate", "params": {{"url": "https://..."}}}}
- click: {{"action": "click", "params": {{"index": <element_index>}}}}
- type: {{"action": "type", "params": {{"index": <element_index>, "text": "..."}}}}
- scroll: {{"action": "scroll", "params": {{"direction": "down|up", "amount": 300}}}}
- select_option: {{"action": "select_option", "params": {{"index": <element_index>, "value": "..."}}}}
- wait: {{"action": "wait", "params": {{"seconds": 2}}}}
- done: {{"action": "done", "params": {{"result": "..."}}}}

Respond ONLY with valid JSON in this format:
{{
  "thinking": "your reasoning here",
  "actions": [<one or more actions from above>]
}}

IMPORTANT: If the task is complete, use the "done" action."""

    user_prompt = f"""TASK: {task}

CURRENT PAGE:
URL: {url}
Title: {title}

PAGE CONTENT (excerpt):
{body_text}

INTERACTIVE ELEMENTS:
{elements_str}

PREVIOUS STEPS:{history_str if history_str else " (none — this is step 1)"}

What should I do next? Respond with JSON."""

    return system_prompt, user_prompt


async def run_extension_agent_loop(
    task_id: str,
    session_id: str,
    task: str,
    tab_id: Optional[int],
    url: Optional[str],
    title: Optional[str],
    llm,
    ws_send,      # async callable: sends message to Extension WS
    ws_recv,      # async callable: receives message from Extension WS (with timeout)
    broadcaster,
    max_steps: int = 20,
):
    """
    Main Extension agent reasoning loop.

    ws_send(data: dict) → sends JSON to Extension
    ws_recv(timeout: float) → returns dict from Extension or raises TimeoutError
    """
    owner = "EXTENSION"
    browser_mode = "EXTENSION_NATIVE"
    browser_id = f"ext_tab_{tab_id or 'current'}"

    state = ExtensionAgentState(
        task_id=task_id,
        session_id=session_id,
        task=task,
        url=url or "",
        title=title or "",
        status="running",
    )

    async def broadcast(evt_type, status, summary, message, data=None):
        await broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=task_id,
                session_id=session_id,
                owner=owner,
                browser_mode=browser_mode,
                browser_id=browser_id,
                tab_id=tab_id,
                event_type=evt_type,
                status=status,
                summary=summary,
                message=message,
                data=data or {},
            )
        )

    try:
        await broadcast(EventType.TASK_STARTED, "RUNNING",
                        f"Extension agent started on {title or url or 'tab'}",
                        "Agent reasoning started. Extension will scrape DOM and execute actions.")

        for step_num in range(1, max_steps + 1):
            state.step = step_num

            # 1. Request DOM snapshot from Extension
            await ws_send({"type": "GET_DOM_SNAPSHOT", "step": step_num})

            try:
                dom_msg = await ws_recv(timeout=20.0)
            except asyncio.TimeoutError:
                raise RuntimeError(f"Extension did not respond with DOM snapshot at step {step_num} (20s timeout)")

            # Skip non-DOM messages (e.g. stray ACTION_RESULT from previous step)
            retries = 0
            while dom_msg.get("type") != "DOM_SNAPSHOT" and retries < 5:
                retries += 1
                try:
                    dom_msg = await ws_recv(timeout=5.0)
                except asyncio.TimeoutError:
                    raise RuntimeError(f"Expected DOM_SNAPSHOT but got: {dom_msg.get('type')} (step {step_num})")

            if dom_msg.get("type") != "DOM_SNAPSHOT":
                raise RuntimeError(f"Expected DOM_SNAPSHOT, got: {dom_msg.get('type')} after {retries} retries")


            dom_snapshot = dom_msg.get("data", {})
            state.url = dom_snapshot.get("url", state.url)
            state.title = dom_snapshot.get("title", state.title)

            await broadcast(EventType.OBSERVATION, "OBSERVED",
                            f"Observing: {state.title or state.url}",
                            f"Step {step_num}: {state.url}",
                            {"step": step_num, "url": state.url, "title": state.title,
                             "element_count": len(dom_snapshot.get("interactiveElements", []))})

            # 2. LLM reasoning
            system_prompt, user_prompt = _build_agent_prompt(task, state, dom_snapshot)

            await broadcast(EventType.THINKING_STATUS, "THINKING",
                            "Analyzing page and planning next action...",
                            f"Step {step_num}: {len(dom_snapshot.get('interactiveElements', []))} elements found")

            try:
                from browser_use.llm.messages import SystemMessage, UserMessage
                messages = [SystemMessage(content=system_prompt), UserMessage(content=user_prompt)]
                response = await llm.ainvoke(messages)
                raw_content = response.content if hasattr(response, "content") else str(response)
            except Exception as e:
                raise RuntimeError(f"LLM call failed at step {step_num}: {e}")

            # 3. Parse LLM response
            thinking = ""
            actions = []
            try:
                # Strip markdown code blocks if present
                content = raw_content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                parsed = json.loads(content)
                thinking = parsed.get("thinking", "")
                actions = parsed.get("actions", [])
                if isinstance(actions, dict):
                    actions = [actions]
            except Exception:
                # Fallback: try to extract JSON from response
                import re
                m = re.search(r'\{.*\}', raw_content, re.DOTALL)
                if m:
                    try:
                        parsed = json.loads(m.group())
                        thinking = parsed.get("thinking", "")
                        actions = parsed.get("actions", [])
                    except Exception:
                        thinking = raw_content[:200]
                        actions = [{"action": "done", "params": {"result": f"Could not parse LLM response: {raw_content[:100]}"}}]

            if thinking:
                await broadcast(EventType.THINKING_STATUS, "THINKING",
                                f"💭 {thinking[:120]}",
                                thinking, {"thinking": thinking, "step": step_num})

            step_record = ExtAgentStep(
                step_num=step_num,
                url=state.url,
                title=state.title,
                dom_summary=f"{len(dom_snapshot.get('interactiveElements', []))} elements",
                thinking=thinking,
                actions=actions,
            )
            state.history.append(step_record)

            # 4. Execute actions via Extension
            task_done = False
            done_result = ""

            for act in actions:
                act_name = act.get("action", "")
                act_params = act.get("params", {})

                if act_name == "done":
                    task_done = True
                    done_result = act_params.get("result", "Task completed")
                    break

                # Broadcast the action
                from deep_browser.bridge.extension_runner import map_action_to_event, ACTION_TO_EVENT_TYPE
                evt_type = ACTION_TO_EVENT_TYPE.get(act_name, EventType.ACTION_REQUESTED)
                target_str = (act_params.get("url") or act_params.get("text") or
                              str(act_params.get("index", "")) or str(act_params))
                await broadcast(evt_type, "EXECUTING",
                                f"{act_name}: {str(target_str)[:80]}",
                                f"Executing {act_name}",
                                {"action": act_name, "params": act_params})

                # Send action to Extension for execution
                await ws_send({
                    "type": "EXECUTE_ACTION",
                    "step": step_num,
                    "action": act_name,
                    "params": act_params,
                    "dom_extraction_js": DOM_EXTRACTION_JS,
                })

                # Wait for action result
                try:
                    result_msg = await ws_recv(timeout=20.0)
                    if result_msg.get("type") == "ACTION_RESULT":
                        success = result_msg.get("success", True)
                        error = result_msg.get("error", "")
                        if not success and error:
                            logger.warning(f"Action {act_name} failed: {error}")
                            await broadcast(EventType.RECOVERY, "WARNING",
                                            f"Action failed: {error[:80]}",
                                            f"Step {step_num} {act_name} failed: {error}")
                except asyncio.TimeoutError:
                    logger.warning(f"Action {act_name} result timeout at step {step_num}")

                # Small pause between actions
                await asyncio.sleep(0.5)

            if task_done:
                state.status = "completed"
                await broadcast(EventType.COMPLETED, "COMPLETED",
                                f"✅ Task completed",
                                done_result,
                                {"result": done_result, "steps": step_num})
                return done_result

        # Max steps reached
        state.status = "completed"
        await broadcast(EventType.COMPLETED, "COMPLETED",
                        f"Task completed ({max_steps} steps)",
                        f"Reached maximum steps ({max_steps}). Last page: {state.url}",
                        {"steps": max_steps})
        return f"Completed {max_steps} steps. Last URL: {state.url}"

    except Exception as e:
        logger.error(f"Extension agent loop failed: {e}", exc_info=True)
        state.status = "failed"
        await broadcast(EventType.FAILED, "FAILED",
                        f"❌ Task failed",
                        str(e),
                        {"error": str(e)})
        raise
