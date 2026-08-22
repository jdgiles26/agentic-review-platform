"""CLI entry point – `review` command."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from graphs.review_graph import run_review
from schemas.models import ReviewCategory, ReviewRequest

app = typer.Typer(
    name="review",
    help="Agentic code & PR review CLI",
    add_completion=False,
)
console = Console()


@app.command("diff")
def review_diff(
    path: Path = typer.Argument(..., help="Path to a unified diff file or '-' for stdin"),
    focus: Optional[list[str]] = typer.Option(None, "--focus", "-f", help="Focus categories"),
    json_out: bool = typer.Option(False, "--json", help="Emit JSON"),
):
    """Review a local diff file."""
    if str(path) == "-":
        diff = sys.stdin.read()
    else:
        diff = path.read_text(encoding="utf-8")

    cats = None
    if focus:
        cats = [ReviewCategory(c) for c in focus]

    req = ReviewRequest(diff=diff, focus=cats)
    result = run_review(req)

    if json_out:
        console.print_json(result.model_dump_json())
        return

    _print_result(result)


@app.command("pr")
def review_pr(
    owner: str = typer.Argument(...),
    repo: str = typer.Argument(...),
    number: int = typer.Argument(...),
    json_out: bool = typer.Option(False, "--json"),
):
    """Review a GitHub pull request (requires GITHUB_TOKEN)."""
    from tools.github.client import GitHubClient

    client = GitHubClient()
    if not client.available:
        console.print("[red]GITHUB_TOKEN not set[/red]")
        raise typer.Exit(1)

    pr = client.get_pr(owner, repo, number)
    diff = client.get_pr_diff(owner, repo, number)

    req = ReviewRequest(
        repo_url=f"https://github.com/{owner}/{repo}",
        pr_number=number,
        diff=diff,
        files=pr.get("files"),
    )
    # Inject PR metadata
    data = req.model_dump()
    data.update(
        {
            "title": pr["title"],
            "body": pr["body"],
            "additions": pr["additions"],
            "deletions": pr["deletions"],
        }
    )
    result = run_review(ReviewRequest(**{k: v for k, v in data.items() if k in ReviewRequest.model_fields}))

    if json_out:
        console.print_json(result.model_dump_json())
        return
    _print_result(result)


@app.command("serve")
def serve(
    host: str = typer.Option("0.0.0.0", "--host"),
    port: int = typer.Option(8000, "--port"),
    reload: bool = typer.Option(False, "--reload"),
):
    """Start the FastAPI server."""
    import uvicorn

    uvicorn.run("api.main:app", host=host, port=port, reload=reload)


def _print_result(result):
    console.print(
        Panel(
            f"[bold]{result.summary}[/bold]\n\n"
            f"Recommendation: [cyan]{result.recommendation}[/cyan]  "
            f"Score: {result.score}  "
            f"Duration: {result.duration_ms} ms",
            title=f"Review {result.request_id[:8]}",
        )
    )
    if not result.findings:
        console.print("[green]No findings[/green]")
        return

    table = Table(title="Findings")
    table.add_column("Sev")
    table.add_column("Category")
    table.add_column("Title")
    table.add_column("File")
    for f in result.findings:
        table.add_row(
            f.severity.value,
            f.category.value,
            f.title,
            f.file_path or "-",
        )
    console.print(table)


if __name__ == "__main__":
    app()
