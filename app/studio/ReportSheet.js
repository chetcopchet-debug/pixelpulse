"use client";
import { useState } from "react";
import Sheet from "./Sheet";

const REASONS = [
  ["nonconsensual", "A real person, without their consent"],
  ["sexual", "Sexual content"],
  ["minor", "Involves a minor"],
  ["violence", "Violence or gore"],
  ["other", "Something else"],
];

// Report a shared image: pick a reason, add details if you want. onDone(message) is called with the outcome.
export default function ReportSheet({ id, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reason, details }) });
      const d = await r.json().catch(() => ({}));
      onDone?.(r.ok ? "Thanks. We'll review it." : d.error || "The report couldn't be sent. Try again.");
    } catch { onDone?.("The report couldn't be sent. Try again."); }
    setBusy(false); onClose?.();
  };
  return (
    <Sheet title="Report this image" sub="Reports are anonymous. Content involving a minor, or a real person without consent, is hidden right away while we review." onClose={onClose}>
      <div className="c" style={{ gap: 8, padding: "4px 8px" }} role="radiogroup" aria-label="Reason">
        {REASONS.map(([k, t]) => (
          <button key={k} role="radio" aria-checked={reason === k} className={`mrow${reason === k ? " on" : ""}`} style={{ minHeight: 52 }} onClick={() => setReason(k)}>
            <span className="grow">{t}</span>{reason === k ? <span className="tick" aria-hidden="true">✓</span> : null}
          </button>
        ))}
        <textarea className="field" maxLength={500} placeholder="Anything else we should know? (optional)" aria-label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <button className="btn btn-p btn-wide" disabled={!reason || busy} onClick={send}>{busy ? "Sending…" : "Send report"}</button>
      </div>
    </Sheet>
  );
}
