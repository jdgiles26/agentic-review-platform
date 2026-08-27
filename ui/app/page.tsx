"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SAMPLE_DIFF = `--- a/src/auth.py
+++ b/src/auth.py
@@ -12,6 +12,9 @@ def login(user, password):
-    return token
+    token = sign(user)
+    print(password)
+    return token
`;

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  file_path?: string;
  suggestion?: string;
  confidence?: number;
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
  cost_usd?: number;
};

type Health = {
  status: string;
  version: string;
  agents_ready: string[];
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function Home() {
  const [mode, setMode] = useState<"diff" | "github">("diff");
  const [diff, setDiff] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/health`)
      .then((r) => {
        if (!r.ok) throw new Error("unhealthy");
        return r.json();
      })
      .then((data: Health) => {
        if (!cancelled) {
          setHealth(data);
          setHealthError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHealthError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    mode === "diff"
      ? Boolean(diff.trim())
      : Boolean(owner.trim() && repo.trim() && prNumber.trim());

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

  const findings = useMemo(() => {
    const list = result?.findings ?? [];
    const filtered =
      severityFilter === "all"
        ? list
        : list.filter((f) => f.severity === severityFilter);
    return [...filtered].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );
  }, [result, severityFilter]);

  const counts = useMemo(() => {
    const list = result?.findings ?? [];
    return SEVERITY_ORDER.reduce<Record<string, number>>((acc, key) => {
      acc[key] = list.filter((f) => f.severity === key).length;
      return acc;
    }, {});
  }, [result]);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 64px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "var(--accent)", fontSize: 12, letterSpacing: 1.2, fontWeight: 700 }}>
            MULTI-AGENT REVIEW
          </p>
          <h1 style={{ margin: "6px 0 4px", fontSize: 28 }}>Review console</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Paste a diff or pull a GitHub PR. Agents return findings with severity and confidence.
          </p>
        </div>
        <HealthChip health={health} error={healthError} />
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <ModeButton active={mode === "diff"} onClick={() => setMode("diff")}>
          Unified diff
        </ModeButton>
        <ModeButton active={mode === "github"} onClick={() => setMode("github")}>
          GitHub PR
        </ModeButton>
      </div>

      <section
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: 16,
          marginBottom: 20,
        }}
      >
        {mode === "diff" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <label htmlFor="diff" style={{ fontWeight: 600 }}>
                Unified diff
              </label>
              <button
                type="button"
                onClick={() => setDiff(SAMPLE_DIFF)}
                style={ghostBtn}
              >
                Load sample
              </button>
            </div>
            <textarea
              id="diff"
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              rows={12}
              placeholder={"--- a/src/main.py\n+++ b/src/main.py\n@@ -1,3 +1,5 @@"}
              style={{
                width: "100%",
                fontSize: 13,
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--bg)",
                resize: "vertical",
              }}
            />
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10 }}>
            <Field label="Owner" value={owner} onChange={setOwner} placeholder="octocat" />
            <Field label="Repo" value={repo} onChange={setRepo} placeholder="hello-world" />
            <Field label="PR #" value={prNumber} onChange={setPrNumber} placeholder="42" />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={runReview}
            disabled={loading || !canSubmit}
            style={{
              padding: "10px 18px",
              background: loading ? "#374151" : "var(--accent)",
              color: "#062016",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            {loading ? "Running agents…" : mode === "diff" ? "Run review" : "Fetch PR and review"}
          </button>
          {loading && (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Supervisor → specialists → merge findings
            </span>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            background: "#2a1214",
            color: "var(--danger)",
            border: "1px solid #7f1d1d",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <strong>Review failed.</strong> {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: "var(--radius)",
            padding: 28,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          No review yet. Paste a diff or load the sample to see findings, confidence, and a merge recommendation.
        </div>
      )}

      {result && (
        <section>
          <ResultHeader result={result} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
            <FilterChip
              label={`All (${result.findings.length})`}
              active={severityFilter === "all"}
              onClick={() => setSeverityFilter("all")}
            />
            {SEVERITY_ORDER.map((s) =>
              counts[s] ? (
                <FilterChip
                  key={s}
                  label={`${s} (${counts[s]})`}
                  active={severityFilter === s}
                  onClick={() => setSeverityFilter(s)}
                />
              ) : null
            )}
          </div>

          {findings.length === 0 ? (
            <p style={{ color: "var(--ok)" }}>No findings in this filter.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {findings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </ul>
          )}
        </section>
      )}

      <footer style={{ marginTop: 48, fontSize: 13, color: "var(--muted)" }}>
        API docs <code>{API}/docs</code> · CLI <code>review diff file.patch</code>
      </footer>
    </main>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "4px 10px",
  color: "var(--accent-2)",
  fontSize: 13,
};

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
        background: active ? "#113226" : "var(--bg-elev)",
        color: active ? "var(--accent)" : "var(--muted)",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
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
  placeholder: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--bg)",
        }}
      />
    </label>
  );
}

function HealthChip({ health, error }: { health: Health | null; error: boolean }) {
  const ok = Boolean(health) && !error;
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--bg-elev)",
        borderRadius: 12,
        padding: "10px 12px",
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: error ? "var(--danger)" : ok ? "var(--ok)" : "var(--warn)",
          }}
        />
        {error ? "API offline" : ok ? `API ${health?.version}` : "Checking API…"}
      </div>
      {health?.agents_ready?.length ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
          {health.agents_ready.length} agents ready
        </p>
      ) : null}
    </div>
  );
}

function ResultHeader({ result }: { result: ReviewResult }) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8, fontSize: 14 }}>
        <Metric label="Status" value={result.status} />
        <Metric label="Recommend" value={result.recommendation ?? "—"} />
        <Metric label="Score" value={result.score != null ? String(result.score) : "—"} />
        <Metric label="Duration" value={result.duration_ms != null ? `${result.duration_ms} ms` : "—"} />
      </div>
      <p style={{ margin: 0 }}>{result.summary}</p>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
        Agents: {result.agents_involved?.join(", ") || "—"}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      <strong>{value}</strong>
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--accent-2)" : "var(--line)"}`,
        background: active ? "#152033" : "transparent",
        color: active ? "var(--accent-2)" : "var(--muted)",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

function FindingCard({ finding: f }: { finding: Finding }) {
  const confidence =
    typeof f.confidence === "number" ? Math.round(f.confidence * 100) : null;
  return (
    <li
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        background: "var(--bg-elev)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            background: severityColor(f.severity),
            color: "#fff",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {f.severity}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.category}</span>
        {confidence != null && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--accent-2)" }}>
            {confidence}% confidence
          </span>
        )}
      </div>
      <strong style={{ display: "block", marginTop: 8 }}>{f.title}</strong>
      <p style={{ margin: "6px 0", fontSize: 14, color: "#d5dde6" }}>{f.description}</p>
      {f.file_path && (
        <code style={{ fontSize: 12, color: "var(--muted)" }}>{f.file_path}</code>
      )}
      {f.suggestion && (
        <pre
          style={{
            background: "var(--bg)",
            padding: 10,
            borderRadius: 6,
            fontSize: 12,
            overflow: "auto",
            border: "1px solid var(--line)",
          }}
        >
          {f.suggestion}
        </pre>
      )}
    </li>
  );
}

function severityColor(s: string) {
  switch (s) {
    case "critical":
      return "#b91c1c";
    case "high":
      return "#c2410c";
    case "medium":
      return "#a16207";
    case "low":
      return "#1d4ed8";
    default:
      return "#6b7280";
  }
}
