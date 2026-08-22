"""FastAPI application – callable HTTP API for the review agents."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from graphs.review_graph import run_review
from schemas.models import (
    GitHubWebhookPayload,
    HealthResponse,
    ReviewRequest,
    ReviewResult,
)
from tools.github.client import GitHubClient

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup / shutdown hooks (e.g. warm model, check token)
    yield


app = FastAPI(
    title="Agentic Review Platform",
    description=(
        "Multi-agent code & PR review API. "
        "Supports direct diff review, GitHub PR review, and webhooks."
    ),
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version=VERSION,
        agents_ready=[
            "supervisor",
            "code_reviewer",
            "pr_specialist",
            "security_specialist",
            "architecture_reviewer",
            "test_specialist",
        ],
    )


@app.post("/v1/review", response_model=ReviewResult)
async def create_review(req: ReviewRequest):
    """Run a full multi-agent review on a diff or PR context."""
    try:
        result = run_review(req)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/v1/review/github/{owner}/{repo}/{number}", response_model=ReviewResult)
async def review_github_pr(owner: str, repo: str, number: int, focus: list[str] | None = None):
    """Fetch a PR from GitHub and run the review pipeline."""
    client = GitHubClient()
    if not client.available:
        raise HTTPException(status_code=503, detail="GITHUB_TOKEN not configured")

    try:
        pr = client.get_pr(owner, repo, number)
        diff = client.get_pr_diff(owner, repo, number)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub error: {e}") from e

    req = ReviewRequest(
        repo_url=f"https://github.com/{owner}/{repo}",
        pr_number=number,
        diff=diff,
        files=pr.get("files"),
        focus=focus,  # type: ignore
    )
    # Attach extra context the graph expects
    data = req.model_dump()
    data.update(
        {
            "title": pr["title"],
            "body": pr["body"],
            "additions": pr["additions"],
            "deletions": pr["deletions"],
        }
    )
    from schemas.models import ReviewRequest as RR

    return run_review(RR(**{k: v for k, v in data.items() if k in RR.model_fields}))


@app.post("/v1/webhooks/github")
async def github_webhook(payload: GitHubWebhookPayload, background: BackgroundTasks):
    """Receive GitHub PR events and trigger reviews in the background."""
    if payload.action not in {"opened", "synchronize", "reopened"}:
        return {"status": "ignored", "reason": f"action={payload.action}"}

    if not payload.pull_request or not payload.repository:
        raise HTTPException(status_code=400, detail="Missing PR or repository")

    # In production: enqueue a job. For scaffold we acknowledge.
    return {
        "status": "accepted",
        "pr": payload.number,
        "repo": payload.repository.get("full_name"),
    }


@app.get("/")
async def root():
    return {
        "name": "Agentic Review Platform",
        "docs": "/docs",
        "health": "/health",
        "review": "POST /v1/review",
        "github_pr": "POST /v1/review/github/{owner}/{repo}/{number}",
    }
