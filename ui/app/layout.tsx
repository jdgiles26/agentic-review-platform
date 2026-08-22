import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic Review Platform",
  description: "Multi-agent code & PR review with GitHub automation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafafa", color: "#111" }}>{children}</body>
    </html>
  );
}
