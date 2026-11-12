"use client";
import { useState } from "react";

// Asks Replicate about every model, one after another, and shows how far it got. Nothing is generated.
export default function CheckModels({ models }) {
  const [state, setState] = useState(null); // { i, total, dead: [], failed: n } | "done"
  const run = async () => {
    const dead = [], unclear = [];
    for (let i = 0; i < models.length; i++) {
      setState({ i: i + 1, total: models.length, name: models[i].name });
      try {
        const r = await fetch("/api/admin/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: models[i].slug }) });
        const d = await r.json();
        if (d.state === "dead") dead.push(models[i].name); else if (d.state !== "alive") unclear.push(models[i].name);
      } catch { unclear.push(models[i].name); }
    }
    setState({ done: true, dead, unclear });
    if (!dead.length && !unclear.length) setTimeout(() => window.location.reload(), 1200); // otherwise the names stay on screen until the page is reloaded by hand
  };
  const busy = state && !state.done;
  return (
    <div className="c" style={{ gap: 8, margin: "0 0 12px" }}>
      <button className="btn btn-s" onClick={run} disabled={Boolean(busy)}>{busy ? `Checking ${state.i} of ${state.total}: ${state.name}` : "Check that every model still runs"}</button>
      {state?.done ? <p className={`sm ${state.dead.length || state.unclear.length ? "bad" : "ok"}`} role="status">{state.dead.length ? `Discontinued: ${state.dead.join(", ")}.` : "Every model that answered is running."}{state.unclear.length ? ` No clear answer for: ${state.unclear.join(", ")}. Reload the page to see what Replicate said about each.` : ""}</p>
        : <p className="sm t3">Nothing is generated and nothing is charged. While the Replicate balance is under $5 it takes about 10 seconds per model.</p>}
    </div>
  );
}
