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
  return (
    <div style={{ marginTop: "auto", paddingTop: 10 }}>
      <button className="btn btn-p btn-wide" onClick={buy} disabled={busy}>{busy ? "Opening checkout…" : label}</button>
      {err && <p className="sm bad" role="alert" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}
