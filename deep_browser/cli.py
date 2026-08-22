import asyncio
import json
import os
import sys
import click
import uvicorn
from rich.console import Console

# Ensure repository root is in sys.path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

console = Console()


@click.group()
def cli():
    """Deep-Browser: Personal local-first browser agent workstation."""
    pass


@cli.command()
@click.option("--host", default="127.0.0.1", help="Host address to bind.")
@click.option("--port", default=8765, type=int, help="Port to bind.")
def serve(host: str, port: int):
    """Start the Deep-Browser companion bridge server for Chrome Extension."""
    console.print(f"[bold cyan]Starting Deep-Browser Bridge Server on http://{host}:{port}[/bold cyan]")
    uvicorn.run("deep_browser.bridge.server:app", host=host, port=port, log_level="info")


@cli.command()
@click.argument("task", required=False, default=None)
@click.option("--provider", default="gemini", help="LLM Provider: gemini, openai, anthropic, ollama")
@click.option("--model", default=None, help="Model name")
@click.option("--attached", is_flag=True, default=False, help="Attach to running browser on port 9222")
@click.option("--browser", "browser_type", default="bundled", help="Browser selection: bundled, chrome, edge, brave")
@click.option("--cdp-port", default=None, type=int, help="CDP port to connect to")
@click.option("--target-id", default=None, help="CDP target ID to drive")
@click.option("--session", "session_id", default=None, help="Session ID")
@click.option("--ndjson", is_flag=True, default=True, help="Emit NDJSON stream for IDE integration")
def run(
    task: str | None,
    provider: str,
    model: str | None,
    headless: bool,
    attached: bool,
    browser_type: str,
    cdp_port: int | None,
    target_id: str | None,
    session_id: str | None,
    ndjson: bool,
):
    """Run an autonomous browser agent task directly from the command line or Desktop IDE."""
    # 1. Read task from argument or standard input
    if not task:
        if not sys.stdin.isatty():
            task = sys.stdin.read().strip()
        if not task:
            if ndjson:
                sys.stdout.write(json.dumps({"type": "error", "message": "No task prompt provided."}) + "\n")
                sys.stdout.flush()
            else:
                console.print("[bold red]Error:[/bold red] No task prompt provided.")
            sys.exit(1)

    is_attached = attached or browser_type.lower() in ("chrome", "edge", "brave")
    resolved_cdp = None
    if cdp_port:
        resolved_cdp = f"http://127.0.0.1:{cdp_port}"
    elif is_attached:
        resolved_cdp = "http://127.0.0.1:9222"

    async def _execute():
        from browser_use import Agent, BrowserProfile, BrowserSession, Tools
        from deep_browser.bridge.server import _create_llm
        from browser_use.browser.chrome import find_browser_executable
        import subprocess
        import httpx

        if ndjson:
            sys.stdout.write(json.dumps({"type": "thinking", "text": f"Initializing Deep-Browser agent with {provider} ({browser_type})..."}) + "\n")
            sys.stdout.flush()

        # If attached mode selected (e.g. Edge or Chrome) and not yet listening, auto-launch
        if is_attached and resolved_cdp:
            port = cdp_port or 9222
            is_running = False
            try:
                async with httpx.AsyncClient(timeout=1.5) as client:
                    res = await client.get(f"{resolved_cdp}/json/version")
                    if res.status_code == 200:
                        is_running = True
            except Exception:
                is_running = False

            if not is_running:
                b_bin = find_browser_executable(browser_type if browser_type != "bundled" else "chrome")
                if b_bin:
                    try:
                        subprocess.Popen([b_bin, f"--remote-debugging-port={port}"])
                        await asyncio.sleep(2.0)
                    except Exception:
                        pass

        profile = BrowserProfile(
            headless=headless,
            cdp_url=resolved_cdp,
        )
        session = BrowserSession(browser_profile=profile)
        
        # Resolve API key from environment
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        selected_model = model or os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite"
        
        llm = _create_llm(provider, selected_model, api_key)
        tools = Tools()

        if ndjson:
            sys.stdout.write(json.dumps({"type": "thinking", "text": f"Running task: {task[:120]}..."}) + "\n")
            sys.stdout.flush()

        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
            tools=tools,
        )

        result = await agent.run()
        
        summary = str(result.final_result()) if hasattr(result, "final_result") else "Task completed."
        if ndjson:
            sys.stdout.write(json.dumps({"type": "done", "summary": summary, "iterations": len(agent.history.history)}) + "\n")
            sys.stdout.flush()
        else:
            console.print(f"[bold green]Task Finished:[/bold green]\n{result}")

    try:
        asyncio.run(_execute())
    except Exception as e:
        err_str = str(e)
        if "ConnectError" in type(e).__name__ or "All connection attempts failed" in err_str:
            err_str = f"Connection failed to Chrome on port 9222. Please start Chrome with '--remote-debugging-port=9222' to use Attached Chrome mode, or use Bundled Chromium."
        if ndjson:
            sys.stdout.write(json.dumps({"type": "error", "message": err_str}) + "\n")
            sys.stdout.flush()
        else:
            console.print(f"[bold red]Execution error:[/bold red] {err_str}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
