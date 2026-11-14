"use client";
import { useState } from "react";

// The owner types in the Replicate balance after adding credit; the page then shows an estimate of what is left.
export default function BalanceForm({ has }) {
  const [usd, setUsd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const save = async (e) => {
    e.preventDefault();
    const v = Number(String(usd).replace(",", "."));
    if (!String(usd).trim() || !Number.isFinite(v) || v < 0) { setNote("Type the balance in dollars, for example 25."); return; }
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/admin/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usd: v }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || "Could not save. Try again."); setBusy(false); return; }
      window.location.reload();
    } catch { setNote("Could not save. Try again."); setBusy(false); }
  };
  return (
    <form onSubmit={save} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <label className="sm t2" htmlFor="replbal">{has ? "Added credit, or the number is off? Type the balance Replicate shows now:" : "Type the balance Replicate shows now:"}</label>
      <input id="replbal" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="$" aria-label="Replicate balance in dollars" style={{ width: 96, height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--fill)", color: "var(--text)" }} />
      <button className="btn btn-s" disabled={busy} style={{ height: 40 }}>{busy ? "Saving" : "Save"}</button>
      {note ? <span className="sm bad" role="alert">{note}</span> : null}
    </form>
  );
}
