"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  file_path?: string;
  suggestion?: string;
};

type ReviewResult = {
  request_id: string;
  status: string;
  summary: string;
  findings: Finding[];
  recommendation?: string;
  score?: number;
  duration_ms?: number;
  agents_involved: string[];
};

type Health = {
  status: string;
  version?: string;
  agents_ready?: string[];
};

type Mode = "diff" | "github";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function Home() {
  const [mode, setMode] = useState<Mode>("diff");
  const [diff, setDiff] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data: Health) => {
        if (!cancelled) setHealth(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setHealthError(e.message || "API offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canRun =
    !loading &&
    (mode === "diff"
      ? Boolean(diff.trim())
      : Boolean(owner.trim() && repo.trim() && prNumber.trim()));

  async function runReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const url =
        mode === "diff"
          ? `${API}/v1/review`
          : `${API}/v1/review/github/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}/${encodeURIComponent(prNumber.trim())}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: mode === "diff" ? JSON.stringify({ diff, include_suggestions: true }) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ReviewResult = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const findings = result?.findings ?? [];
  const visible = useMemo(() => {
    const list =
      severityFilter === "all"
        ? findings
        : findings.filter((f) => f.severity === severityFilter);
    return [...list].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );
  }, [findings, severityFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
    return c;
  }, [findings]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Multi-agent review</p>
          <h1>Review Console</h1>
        </div>
        <HealthPill health={health} error={healthError} />
      </header>

      <div className="layout">
        <section className="panel input-panel">
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "diff"}
              className={mode === "diff" ? "tab on" : "tab"}
              onClick={() => setMode("diff")}
            >
              Paste diff
            </button>
            <button
              role="tab"
              aria-selected={mode === "github"}
              className={mode === "github" ? "tab on" : "tab"}
              onClick={() => setMode("github")}
            >
              GitHub PR
            </button>
          </div>

          {mode === "diff" ? (
            <>
              <label htmlFor="diff">Unified diff</label>
              <textarea
                id="diff"
                value={diff}
                onChange={(e) => setDiff(e.target.value)}
                rows={16}
                placeholder={"--- a/src/main.py\n+++ b/src/main.py\n@@ -1,3 +1,5 @@\n ..."}
              />
            </>
          ) : (
            <div className="pr-grid">
              <Field label="Owner" value={owner} onChange={setOwner} placeholder="jdgiles26" />
              <Field label="Repo" value={repo} onChange={setRepo} placeholder="agentic-review-platform" />
              <Field label="PR #" value={prNumber} onChange={setPrNumber} placeholder="42" />
              <p className="hint">
                Uses <code>POST /v1/review/github/{"{owner}/{repo}/{number}"}</code>. Requires
                <code> GITHUB_TOKEN</code> on the API.
              </p>
            </div>
          )}

          <div className="actions">
            <button className="primary" onClick={runReview} disabled={!canRun}>
              {loading ? "Running agents…" : mode === "diff" ? "Run review" : "Review PR"}
            </button>
            {loading && <span className="pulse">Supervisor + specialists in flight</span>}
          </div>
        </section>

        <section className="panel results">
          {error && (
            <div className="banner bad" role="alert">
              <strong>Review failed.</strong> {error}
            </div>
          )}

          {!result && !error && !loading && (
            <EmptyState mode={mode} />
          )}

          {loading && <LoadingState />}

          {result && (
            <>
              <div className="summary">
                <div className="metrics">
                  <Metric label="Status" value={result.status} />
                  <Metric label="Recommendation" value={result.recommendation || "—"} emphasis />
                  <Metric label="Score" value={result.score == null ? "—" : String(result.score)} />
                  <Metric
                    label="Duration"
                    value={result.duration_ms != null ? `${result.duration_ms} ms` : "—"}
                  />
                </div>
                <p className="lede">{result.summary}</p>
                {result.agents_involved?.length > 0 && (
                  <div className="chips">
                    {result.agents_involved.map((a) => (
                      <span key={a} className="chip">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="findings-head">
                <h2>Findings ({visible.length})</h2>
                <div className="filters">
                  <FilterChip label="all" count={findings.length} active={severityFilter === "all"} onClick={() => setSeverityFilter("all")} />
                  {SEVERITY_ORDER.filter((s) => counts[s]).map((s) => (
                    <FilterChip
                      key={s}
                      label={s}
                      count={counts[s]}
                      active={severityFilter === s}
                      onClick={() => setSeverityFilter(s)}
                    />
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="ok-empty">No findings in this filter.</p>
              ) : (
                <ul className="findings">
                  {visible.map((f) => (
                    <li key={f.id} className="finding">
                      <div className="finding-meta">
                        <span className={`sev sev-${f.severity}`}>{f.severity}</span>
                        <span className="cat">{f.category}</span>
                        {f.file_path && <code className="path">{f.file_path}</code>}
                      </div>
                      <strong>{f.title}</strong>
                      <p>{f.description}</p>
                      {f.suggestion && <pre>{f.suggestion}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="foot">
        API <code>{API}/docs</code> · CLI <code>review diff file.patch</code>
      </footer>

      <style jsx>{`
        .shell { max-width: 1180px; margin: 0 auto; padding: 24px 20px 48px; }
        .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
        .eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
        h1 { margin: 0; font-size: 28px; letter-spacing: -0.03em; }
        .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; }
        @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
        .panel { background: var(--bg-elev); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; min-height: 420px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; color: var(--muted); }
        .tab.on { color: var(--bg); background: var(--accent); border-color: var(--accent); font-weight: 600; }
        label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 13px; }
        textarea, input {
          width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
          padding: 12px; color: var(--text);
        }
        textarea { font-family: ui-monospace, monospace; font-size: 13px; min-height: 280px; resize: vertical; }
        .pr-grid { display: grid; gap: 12px; }
        .hint { color: var(--muted); font-size: 13px; margin: 0; }
        .actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
        .primary {
          background: var(--accent); color: #062016; border: none; border-radius: 8px;
          padding: 10px 16px; font-weight: 700; cursor: pointer;
        }
        .primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .pulse { color: var(--muted); font-size: 13px; }
        .banner { padding: 12px; border-radius: 8px; margin-bottom: 12px; }
        .banner.bad { background: #3f1d24; color: #fecaca; }
        .summary { margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
        @media (max-width: 700px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
        .lede { margin: 0 0 12px; color: var(--text); }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { font-size: 12px; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; color: var(--muted); }
        .findings-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
        h2 { margin: 0; font-size: 16px; }
        .filters { display: flex; flex-wrap: wrap; gap: 6px; }
        .findings { list-style: none; padding: 0; margin: 12px 0 0; }
        .finding { border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 8px; background: var(--bg-soft); }
        .finding-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 6px; }
        .sev { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; color: #0b0d12; }
        .sev-critical { background: #f87171; }
        .sev-high { background: #fb923c; }
        .sev-medium { background: #fbbf24; }
        .sev-low { background: #7dd3fc; }
        .sev-info { background: #94a3b8; }
        .cat { font-size: 12px; color: var(--muted); }
        .path { font-size: 12px; color: var(--accent-2); }
        .finding p { margin: 6px 0 0; font-size: 14px; color: #d5dbe6; }
        .finding pre { background: var(--bg); padding: 8px; border-radius: 6px; overflow: auto; font-size: 12px; }
        .ok-empty { color: var(--ok); }
        .foot { margin-top: 28px; color: var(--muted); font-size: 13px; }
      `}</style>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontWeight: emphasis ? 700 : 600, marginTop: 4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: "1px solid var(--line)",
        background: active ? "var(--accent)" : "var(--bg)",
        color: active ? "#062016" : "var(--muted)",
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label} {count}
    </button>
  );
}

function HealthPill({ health, error }: { health: Health | null; error: string | null }) {
  const ok = Boolean(health && !error);
  return (
    <div
      title={error || health?.agents_ready?.join(", ") || "checking"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: error ? "var(--danger)" : ok ? "var(--ok)" : "var(--warn)",
        }}
      />
      <span>
        {error ? "API offline" : ok ? `API ${health?.status} · v${health?.version ?? "?"}` : "Checking API…"}
      </span>
    </div>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div style={{ color: "var(--muted)", padding: "48px 8px" }}>
      <h2 style={{ margin: "0 0 8px", color: "var(--text)" }}>No review yet</h2>
      <p style={{ margin: 0 }}>
        {mode === "diff"
          ? "Paste a unified diff and run the specialist pipeline. Findings land here with severity first."
          : "Enter owner, repo, and PR number. The API fetches the diff and runs the same agents."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ color: "var(--muted)", padding: "32px 8px" }}>
      <p style={{ margin: 0 }}>Agents reviewing… findings will group by severity when the graph finishes.</p>
    </div>
  );
}
