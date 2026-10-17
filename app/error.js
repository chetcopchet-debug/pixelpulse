"use client";
import { useEffect } from "react";
import { reportClientError } from "./telemetry";

// Route-level error boundary: reports the error and offers a retry instead of a blank page.
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => { reportClientError(error, "boundary"); }, [error]);
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070a", color: "#e9e7f5", fontFamily: "system-ui,sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 34 }}>◉</div>
        <h1 style={{ fontSize: 20, margin: "8px 0" }}>Something skipped a beat</h1>
        <p style={{ color: "#a1a1b5", fontSize: 14 }}>We logged the problem. Try again — your images and credits are safe.</p>
        <button onClick={() => reset()} style={{ marginTop: 8, padding: "12px 22px", borderRadius: 999, border: "none", background: "linear-gradient(90deg,#9333ea,#ec4899)", color: "#fff", fontWeight: 800, fontSize: 15 }}>Try again</button>
        <p><a href="/" style={{ color: "#7c7c94", fontSize: 13 }}>Back to the studio</a></p>
      </div>
    </main>
  );
}
