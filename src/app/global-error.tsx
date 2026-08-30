"use client";

import { useEffect } from "react";

// Backstop for the one case error.tsx can't catch: a crash inside
// layout.tsx itself (e.g. the Supabase user/profile fetch at the top of
// RootLayout throwing). error.tsx renders INSIDE the layout, so if the
// layout is what's broken, error.tsx never even mounts — this is the
// only boundary above that point, which is why it has to render its own
// <html>/<body> instead of relying on layout.tsx's (a broken layout is
// exactly what this exists to survive). Same idea as error.tsx: no dead
// end, always a link back in.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "sans-serif" }}>
          <p style={{ fontSize: 32 }}>⚠️</p>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#262626" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#525252", marginTop: 8 }}>
            This is a bug, not something you did — sorry about that.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#a3a3a3", marginTop: 8 }}>
              Error reference: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: 999,
                backgroundColor: "#6C3FD1",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                padding: "6px 16px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: 999,
                border: "1px solid #d4d4d4",
                color: "#525252",
                fontSize: 14,
                padding: "6px 16px",
                textDecoration: "none",
              }}
            >
              Back to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
