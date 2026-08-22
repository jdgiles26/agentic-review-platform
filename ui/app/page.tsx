"use client";

import { useState } from "react";

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

export default function Home() {
  const [diff, setDiff] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/v1/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff, include_suggestions: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ReviewResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>Agentic Review Platform</h1>
        <p style={{ color: "#666", marginTop: 4 }}>
          Multi-agent code & PR review · API · CLI · GitHub automation
        </p>
      </header>

      <section style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
          Paste a unified diff
        </label>
        <textarea
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          rows={14}
          placeholder={"--- a/src/main.py\n+++ b/src/main.py\n@@ -1,3 +1,5 @@\n ..."}
          style={{
            width: "100%",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={runReview}
          disabled={loading || !diff.trim()}
          style={{
            marginTop: 12,
            padding: "10px 20px",
            background: loading ? "#999" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Running agents…" : "Run Review"}
        </button>
      </section>

      {error && (
        <div style={{ background: "#fee", color: "#900", padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {result && (
        <section>
          <div
            style={{
              background: "#f8f8f8",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              <span>
                <strong>Status:</strong> {result.status}
              </span>
              <span>
                <strong>Recommendation:</strong>{" "}
                <code>{result.recommendation}</code>
              </span>
              <span>
                <strong>Score:</strong> {result.score ?? "—"}
              </span>
              <span>
                <strong>Duration:</strong> {result.duration_ms} ms
              </span>
            </div>
            <p style={{ margin: 0 }}>{result.summary}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
              Agents: {result.agents_involved?.join(", ")}
            </p>
          </div>

          {result.findings.length === 0 ? (
            <p style={{ color: "#080" }}>No findings reported.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {result.findings.map((f) => (
                <li
                  key={f.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 12,
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
                    <span style={{ fontSize: 12, color: "#666" }}>{f.category}</span>
                  </div>
                  <strong style={{ display: "block", marginTop: 6 }}>{f.title}</strong>
                  <p style={{ margin: "4px 0", fontSize: 14 }}>{f.description}</p>
                  {f.file_path && (
                    <code style={{ fontSize: 12 }}>{f.file_path}</code>
                  )}
                  {f.suggestion && (
                    <pre
                      style={{
                        background: "#f0f0f0",
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 12,
                        overflow: "auto",
                      }}
                    >
                      {f.suggestion}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer style={{ marginTop: 48, fontSize: 13, color: "#888" }}>
        API docs at <code>{API}/docs</code> · CLI: <code>review diff file.patch</code>
      </footer>
    </main>
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
