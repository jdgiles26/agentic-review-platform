"""Base agent utilities and shared LLM factory."""

from __future__ import annotations

import os
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from schemas.models import AgentRole


def get_llm(model: str | None = None, temperature: float = 0.1) -> BaseChatModel:
    """Create a chat model. Falls back to a cheap model if none configured."""
    model_name = model or os.getenv("REVIEW_MODEL", "gpt-4o-mini")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Allow local / mock usage without key for scaffolding
        return ChatOpenAI(model=model_name, temperature=temperature, api_key="sk-dummy")
    return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)


class AgentConfig(BaseModel):
    role: AgentRole
    name: str
    system_prompt: str
    max_iterations: int = 8
    tools: list[str] = []


ROLE_PROMPTS: dict[AgentRole, str] = {
    AgentRole.SUPERVISOR: (
        "You are the review supervisor. You coordinate specialist agents, "
        "decide which specialists to invoke, synthesize their findings, "
        "remove duplicates, rank by severity, and produce a final recommendation "
        "(approve / request_changes / comment). Never invent findings."
    ),
    AgentRole.CODE_REVIEWER: (
        "You are a senior code reviewer. Focus on correctness, readability, "
        "edge cases, error handling, and maintainability. Cite exact file:line "
        "when possible. Prefer concrete suggestions over vague advice."
    ),
    AgentRole.SECURITY_SPECIALIST: (
        "You are a security specialist. Look for injection, auth/authz flaws, "
        "secrets in code, insecure defaults, dependency CVEs, and data exposure. "
        "Only report real or high-probability issues. Severity must be accurate."
    ),
    AgentRole.PR_SPECIALIST: (
        "You are a PR specialist. Evaluate title, description quality, linked issues, "
        "commit hygiene, size of the change, test plan, and whether the PR is ready "
        "to merge. Suggest labels and reviewers when useful. Draft a clear review comment."
    ),
    AgentRole.ARCHITECTURE_REVIEWER: (
        "You are an architecture reviewer. Check layering, coupling, module boundaries, "
        "scalability implications, and consistency with existing patterns. Flag major "
        "design smells only."
    ),
    AgentRole.TEST_SPECIALIST: (
        "You are a test specialist. Assess coverage of new logic, missing edge cases, "
        "flaky patterns, and whether tests actually assert behaviour. Suggest concrete "
        "test cases when gaps exist."
    ),
    AgentRole.STYLE_LINTER: (
        "You are a style and conventions specialist. Enforce project conventions, "
        "naming, formatting, and documentation completeness. Only raise issues that "
        "matter for long-term maintainability."
    ),
}
