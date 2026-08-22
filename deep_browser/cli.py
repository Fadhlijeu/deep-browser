"""
CLI interface for Deep-Browser.
"""

import asyncio
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
@click.argument("task")
@click.option("--provider", default="gemini", help="LLM Provider: gemini, openai, anthropic, ollama")
@click.option("--model", default=None, help="Model name")
@click.option("--headless", is_flag=True, default=False, help="Run browser in headless mode")
@click.option("--attached", is_flag=True, default=False, help="Attach to running Chrome on port 9222")
def run(task: str, provider: str, model: str | None, headless: bool, attached: bool):
    """Run an autonomous browser agent task directly from the command line."""
    from browser_use import Agent, BrowserProfile, BrowserSession, Tools
    from deep_browser.bridge.server import _create_llm

    console.print(f"[bold green]Running task:[/bold green] {task}")
    
    profile = BrowserProfile(
        headless=headless,
        cdp_url="http://localhost:9222" if attached else None,
    )
    session = BrowserSession(browser_profile=profile)
    llm = _create_llm(provider, model, None)
    tools = Tools()

    agent = Agent(
        task=task,
        llm=llm,
        browser_session=session,
        tools=tools,
    )

    result = agent.run_sync()
    console.print(f"[bold green]Task Finished:[/bold green]\n{result}")


if __name__ == "__main__":
    cli()
