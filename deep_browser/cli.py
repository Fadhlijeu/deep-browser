"""
CLI interface for Deep-Browser.
Provides command-line runner and bridge utilities.
"""

import asyncio
import json
import os
import sys
import click
import uvicorn
from rich.console import Console

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
@click.option("--headless", is_flag=True, default=False, help="Run browser in headless mode")
@click.option("--attached", is_flag=True, default=False, help="Attach to running Chrome on port 9222")
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

    async def _execute():
        from browser_use import Agent, BrowserProfile, BrowserSession, Tools
        from deep_browser.bridge.server import _create_llm

        resolved_cdp = None
        if cdp_port:
            resolved_cdp = f"http://127.0.0.1:{cdp_port}"
        elif attached:
            resolved_cdp = "http://127.0.0.1:9222"

        if ndjson:
            sys.stdout.write(json.dumps({"type": "thinking", "text": f"Initializing Deep-Browser agent with {provider}..."}) + "\n")
            sys.stdout.flush()

        profile = BrowserProfile(
            headless=headless,
            cdp_url=resolved_cdp,
        )
        session = BrowserSession(browser_profile=profile)
        
        # Resolve API key from environment
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        selected_model = model or os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
        
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
        if ndjson:
            sys.stdout.write(json.dumps({"type": "error", "message": str(e)}) + "\n")
            sys.stdout.flush()
        else:
            console.print(f"[bold red]Execution error:[/bold red] {e}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
