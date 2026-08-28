# Agentic Review Platform

Multi-agent AI system for **code review**, **PR specialist review**, **GitHub automation**, and **model/code quality review**.

Exposes:

| Surface | How to use |
|---------|------------|
| **Website / Dashboard** | Next.js UI at `ui/` – paste a diff *or* review a live GitHub PR |
| **HTTP API** | FastAPI – `POST /v1/review`, GitHub PR endpoint, webhooks |
| **CLI** | `review diff file.patch` or `review pr owner repo number` |
| **GitHub automation** | Webhook receiver + optional comment/label actions |

## Architecture

```
Supervisor
 ├── Code Reviewer
 ├── Security Specialist
 ├── PR Specialist
 ├── Architecture Reviewer
 ├── Test Specialist
 └── Style Linter
        ↓
   Synthesize → Recommendation (approve / request_changes / comment)
```

Built with **LangGraph**, **Pydantic**, **FastAPI**, **Typer**, **Next.js**.

## Quick start

### 1. Backend

```bash
cd agentic-review-platform
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # add OPENAI_API_KEY and optionally GITHUB_TOKEN

# API
review serve
# → http://localhost:8000/docs
```

### 2. CLI

```bash
review diff my-change.patch
review pr myorg myrepo 42 --json
```

### 3. Website

```bash
cd ui
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# → http://localhost:3000
```

The console:

- shows live `/health` status in the header
- accepts a pasted unified diff **or** owner / repo / PR number
- groups findings by severity and lets you filter them

### 4. Docker

```bash
docker build -t agentic-review .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... agentic-review
```

## API examples

```bash
# Health
curl http://localhost:8000/health

# Review a diff
curl -X POST http://localhost:8000/v1/review \
  -H 'Content-Type: application/json' \
  -d '{"diff": "--- a/foo.py\n+++ b/foo.py\n@@ ..."}'

# Review a live GitHub PR
curl -X POST http://localhost:8000/v1/review/github/owner/repo/123
```

## Agents

| Agent | Responsibility |
|-------|----------------|
| Supervisor | Plans which specialists to run, synthesizes final recommendation |
| Code Reviewer | Correctness, edge cases, maintainability |
| Security Specialist | Injection, secrets, auth flaws, CVEs |
| PR Specialist | Title/body quality, size, labels, review comment |
| Architecture Reviewer | Coupling, boundaries, design consistency |
| Test Specialist | Coverage gaps, missing edge-case tests |
| Style Linter | Conventions, naming, docs |

## GitHub automation

1. Create a GitHub App or personal token with `pull_requests: write` + `contents: read`.
2. Set `GITHUB_TOKEN`.
3. Point a repository webhook at `POST /v1/webhooks/github` (events: `pull_request`).
4. On `opened` / `synchronize` the platform can enqueue a review and post findings as a PR comment.

## Development

```bash
pytest --cov=agents --cov=graphs --cov-fail-under=60
ruff check .
```

## Project layout

```
agentic-review-platform/
├── agents/           # specialist agents
├── graphs/           # LangGraph orchestration
├── tools/            # GitHub client, code tools
├── schemas/          # Pydantic models (API contract)
├── api/              # FastAPI app
├── cli/              # Typer CLI
├── memory/           # checkpoint / state (future)
├── ui/               # Next.js dashboard
├── tests/
├── docker/
└── .github/workflows/
```

## License

MIT
