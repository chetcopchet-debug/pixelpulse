"use client";
import { useEffect } from "react";
import { reportClientError } from "./telemetry";

// Last-resort boundary (errors in the root layout). Must render its own <html>/<body>.
export default function GlobalError({ error, reset }) {
  useEffect(() => { reportClientError(error, "global"); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070a", color: "#e9e7f5", fontFamily: "system-ui,sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 34 }}>◉</div>
          <h1 style={{ fontSize: 20, margin: "8px 0" }}>Something skipped a beat</h1>
          <p style={{ color: "#a1a1b5", fontSize: 14 }}>We logged the problem. Please try again.</p>
          <button onClick={() => reset()} style={{ marginTop: 8, padding: "12px 22px", borderRadius: 999, border: "none", background: "linear-gradient(90deg,#9333ea,#ec4899)", color: "#fff", fontWeight: 800, fontSize: 15 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
