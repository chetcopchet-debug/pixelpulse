"use client";
import { useState } from "react";

// The owner types in the Replicate balance after adding credit; the page then shows an estimate of what is left.
// It is an ordinary form that posts to /api/admin/balance, so it saves even when the page's code is not running
// (the page then comes back with ?b=ok). When the code is running it saves without leaving the page first.
// `result`: what the address says about the last save ("ok", "bad", "fail").
const SAID = { ok: "Saved.", bad: "Type the balance in dollars, for example 25.", fail: "The balance could not be saved. Try again." };
export default function BalanceForm({ has, result }) {
  const [usd, setUsd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // [text, good]
  const save = async (e) => {
    e.preventDefault();
    if (!String(usd).trim()) { setNote([SAID.bad, false]); return; }
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/admin/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usd: String(usd) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setNote([d.error || SAID.fail, false]); setBusy(false); return; }
      window.location.assign(`/admin?b=ok&n=${Date.now()}#balance`); // a new address each time, so the page is really loaded again
    } catch { setNote([SAID.fail, false]); setBusy(false); }
  };
  const shown = note || (SAID[result] ? [SAID[result], result === "ok"] : null);
  return (
    <form id="balance" method="post" action="/api/admin/balance" onSubmit={save} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <label className="sm t2" htmlFor="replbal">{has ? "Added credit, or the number is off? Type the balance Replicate shows now:" : "Type the balance Replicate shows now:"}</label>
      <input id="replbal" name="usd" inputMode="decimal" autoComplete="off" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="25" aria-label="Replicate balance in dollars" style={{ width: 96, height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--fill)", color: "var(--text)" }} />
      <button className="btn btn-s" type="submit" disabled={busy} style={{ height: 40 }}>{busy ? "Saving" : "Save"}</button>
      {shown ? <span className={`sm b ${shown[1] ? "ok" : "bad"}`} role={shown[1] ? "status" : "alert"}>{shown[0]}</span> : null}
    </form>
  );
}
