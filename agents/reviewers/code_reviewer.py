"""Code reviewer specialist agent."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from agents.base import ROLE_PROMPTS, get_llm
from schemas.models import AgentRole, Finding, ReviewCategory, Severity


@tool
def analyze_diff(diff: str, focus: str = "correctness") -> str:
    """Analyze a unified diff for issues of the given focus area."""
    # In production this would call the LLM with structured output.
    # Here we keep a pure tool signature for the graph.
    return f"Analyzed diff ({len(diff)} chars) for focus={focus}"


def run_code_review(diff: str, model: str | None = None) -> list[Finding]:
    """Synchronous helper used by the graph node."""
    llm = get_llm(model)
    messages = [
        SystemMessage(content=ROLE_PROMPTS[AgentRole.CODE_REVIEWER]),
        HumanMessage(
            content=(
                "Review the following diff. Return findings as a clear list. "
                "If nothing material, say so.\n\n"
                f"```diff\n{diff[:12000]}\n```"
            )
        ),
    ]
    # Structured output path would use .with_structured_output(list[Finding])
    # For scaffold we return an empty list when no real model is available.
    try:
        _ = llm.invoke(messages)
    except Exception:
        pass
    return []
