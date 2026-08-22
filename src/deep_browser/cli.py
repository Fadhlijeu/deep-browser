"""
Command-line interface (CLI) for Deep-Browser.
"""

import asyncio
import logging
import sys
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
import uvicorn
from deep_browser.agent.core import DeepBrowserAgent
from deep_browser.browser.runtime import browser_manager
from deep_browser.config import settings
from deep_browser.models.task import Task

console = Console()


@click.group()
def main():
    """Deep-Browser: Personal Local-First Browser Agent Workstation."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@main.command()
@click.option("--host", default="127.0.0.1", help="Host to bind companion server")
@click.option("--port", default=8765, type=int, help="Port to bind companion server")
@click.option("--reload", is_flag=True, help="Enable auto-reload for development")
def serve(host: str, port: int, reload: bool):
    """Start Deep-Browser companion server & Workstation IDE."""
    console.print(
        Panel.fit(
            f"[bold cyan]Deep-Browser Workstation Server[/bold cyan]\n"
            f"⚡ URL: [bold green]http://{host}:{port}[/bold green]\n"
            f"📡 WebSocket: [bold green]ws://{host}:{port}/ws[/bold green]\n"
            f"🔒 Safe Mode: [yellow]{settings.safe_mode}[/yellow] | Provider: [magenta]{settings.llm_provider}[/magenta]",
            title="🌐 Deep-Browser",
            border_style="cyan",
        )
    )
    uvicorn.run("deep_browser.server.app:app", host=host, port=port, reload=reload)


@main.command()
@click.argument("goal")
@click.option("--mode", type=click.Choice(["attached", "managed"]), default="managed", help="Browser mode")
@click.option("--profile", default="default", help="Browser profile name")
def run(goal: str, mode: str, profile: str):
    """Run an autonomous browser agent task directly from terminal."""
    console.print(
        Panel.fit(
            f"[bold]Goal:[/bold] {goal}\n[bold]Mode:[/bold] {mode} | [bold]Profile:[/bold] {profile}",
            title="🚀 Starting Deep-Browser Agent",
            border_style="green",
        )
    )

    task = Task(goal=goal, browser_mode=mode, profile_id=profile)

    def on_cli_event(event_type: str, data: dict):
        if event_type == "STEP_PLANNED":
            step = data.get("step")
            thought = data.get("thought", "")
            action = data.get("action", {})
            console.print(f"\n[bold cyan]─── Step {step}: PLAN & OBSERVE ───[/bold cyan]")
            console.print(f"[dim]{thought}[/dim]")
            console.print(f"[bold yellow]Action:[/bold yellow] {action.get('tool')} {action.get('params')}")
        elif event_type == "ACTION_RECEIPT":
            receipt = data.get("receipt", {})
            ver = receipt.get("verification", {})
            status = ver.get("status")
            status_color = "green" if status == "VERIFIED" else "red"
            console.print(
                f"[{status_color}]● Verification: [{status}][/{status_color}] {ver.get('actual_state', '')}"
            )
        elif event_type == "TASK_COMPLETED":
            console.print(
                Panel.fit(
                    f"[bold green]Task Successfully Completed![/bold green]\n{task.result_summary or 'Done'}",
                    border_style="green",
                )
            )

    agent = DeepBrowserAgent(task=task, on_event=on_cli_event)

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        console.print("\n[yellow]Task interrupted by user.[/yellow]")
    finally:
        asyncio.run(browser_manager.close_session(task.session_id or f"sess_{task.id}"))


@main.group()
def session():
    """Manage browser sessions."""
    pass


@session.command("list")
def list_sessions():
    """List active browser sessions."""
    sessions = asyncio.run(browser_manager.list_active_sessions())
    table = Table(title="Active Browser Sessions")
    table.add_column("Session ID", style="cyan")
    table.add_column("Profile", style="magenta")
    table.add_column("Mode", style="green")
    table.add_column("Current URL", style="white")

    for s in sessions:
        table.add_row(s["session_id"], s["profile_id"], s["mode"], s["url"])

    console.print(table)


if __name__ == "__main__":
    main()
