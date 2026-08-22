"""PR specialist – evaluates PR metadata and drafts review actions."""

from __future__ import annotations

from agents.base import ROLE_PROMPTS, get_llm
from schemas.models import AgentRole, PRAction, Severity


def evaluate_pr(
    title: str,
    body: str | None,
    changed_files: list[str],
    additions: int,
    deletions: int,
    model: str | None = None,
) -> tuple[str, list[PRAction]]:
    """Return a summary and recommended GitHub actions."""
    llm = get_llm(model)
    prompt = (
        f"{ROLE_PROMPTS[AgentRole.PR_SPECIALIST]}\n\n"
        f"Title: {title}\n"
        f"Body:\n{body or '(empty)'}\n"
        f"Files changed: {len(changed_files)}\n"
        f"+{additions} -{deletions}\n"
        f"Sample files: {changed_files[:15]}"
    )
    try:
        response = llm.invoke(prompt)
        summary = response.content if hasattr(response, "content") else str(response)
    except Exception:
        summary = "PR specialist unavailable (no API key or network). Manual review recommended."

    actions: list[PRAction] = []
    if additions + deletions > 800:
        actions.append(
            PRAction(
                action="label",
                labels=["size/XL"],
                body="Large change – consider splitting if possible.",
            )
        )
    if not body or len(body.strip()) < 40:
        actions.append(
            PRAction(
                action="comment",
                body="Please expand the PR description with motivation, test plan, and risk notes.",
            )
        )
    return summary, actions
