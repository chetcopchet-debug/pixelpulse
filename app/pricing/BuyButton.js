"use client";
import { useState } from "react";
// The words come from the page (labels), already in the visitor's language.
// `open`: buying is open. When it is not, the button only says so.
export default function BuyButton({ plan, label, labels = {}, open = true }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const buy = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      if (r.status === 401) { setErr(labels.signin || d.error); setBusy(false); return; }
      setErr(labels.failed || d.error || "Checkout is unavailable right now.");
    } catch { setErr(labels.failed || "Checkout is unavailable right now."); }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: "auto", paddingTop: 10 }}>
      {open ? <button className="btn btn-p btn-wide" onClick={buy} disabled={busy}>{busy ? labels.busy || "Opening checkout…" : label}</button>
        : <button className="btn btn-s btn-wide" disabled>{labels.soon || "Coming soon"}</button>}
      {err && <p className="sm bad" role="alert" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}
