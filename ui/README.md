# Review console UI

Next.js 14 app for `agentic-review-platform`.

## What changed

- Dark console layout with clearer hierarchy and a sticky primary action.
- Live `/health` chip so you can see if the API and agents are up.
- Empty, loading, and error states.
- Findings show **confidence** from the existing schema and can be filtered by severity.
- **GitHub PR mode** calls `POST /v1/review/github/{owner}/{repo}/{number}`.

## Run

```bash
cd ui
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
