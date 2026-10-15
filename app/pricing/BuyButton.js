"use client";
import { useState } from "react";
export default function BuyButton({ plan, label }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const buy = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setErr(d.error || "Checkout is unavailable right now.");
    } catch { setErr("Checkout is unavailable right now."); }
    setBusy(false);
  };
  return <div style={{ marginTop: 12 }}>
    <button onClick={buy} disabled={busy} style={{ width: "100%", padding: "11px 14px", borderRadius: 999, border: 0, fontWeight: 800, fontSize: 15, color: "#fff", background: "linear-gradient(90deg,#a855f7,#ec4899)", opacity: busy ? .6 : 1, cursor: "pointer" }}>{busy ? "Opening checkout…" : label}</button>
    {err && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#fca5a5" }}>{err}</p>}
  </div>;
}
