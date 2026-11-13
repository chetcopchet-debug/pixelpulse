"use client";
import { useState } from "react";
// The words come from the page (labels), already in the visitor's language.
export default function BuyButton({ plan, label, labels = {} }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const buy = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setErr(labels.failed || d.error || "Checkout is unavailable right now.");
    } catch { setErr(labels.failed || "Checkout is unavailable right now."); }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: "auto", paddingTop: 10 }}>
      <button className="btn btn-p btn-wide" onClick={buy} disabled={busy}>{busy ? labels.busy || "Opening checkout…" : label}</button>
      {err && <p className="sm bad" role="alert" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}
