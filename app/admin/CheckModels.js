"use client";
import { useState } from "react";

// Asks Replicate about every model, one after another, and shows how far it got. Nothing is generated.
// One real image of each shape with one image model. Replicate charges for the three images.
function TestShapes({ models }) {
  const [slug, setSlug] = useState(models[0]?.slug || "");
  const [rows, setRows] = useState(null); // [{ shape, ok, size, why }] as they arrive
  const [busy, setBusy] = useState("");
  const run = async () => {
    const out = []; setRows(out);
    for (const shape of ["1:1", "16:9", "9:16"]) {
      setBusy(shape);
      try {
        const r = await fetch("/api/admin/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, shape }) });
        out.push({ shape, ...(await r.json()) });
      } catch { out.push({ shape, ok: false, why: "no answer" }); }
      setRows([...out]);
    }
    setBusy("");
  };
  if (!models.length) return null;
  return (
    <div className="c" style={{ gap: 8, margin: "0 0 12px" }}>
      <div className="r" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="field" style={{ flex: "1 1 180px", height: 44 }} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Image model to test" disabled={Boolean(busy)}>
          {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
        <button className="btn btn-s" style={{ height: 44 }} onClick={run} disabled={Boolean(busy)}>{busy ? `Making ${busy}…` : "Test every shape"}</button>
      </div>
      {rows ? rows.map((x) => <p key={x.shape} className={`sm ${x.ok ? "ok" : "bad"}`} role="status">{x.shape}: {x.ok ? `works${x.size ? `, ${x.size}` : ""}` : `failed. ${x.why || x.error || ""}`}</p>)
        : <p className="sm t3">Makes three real images (1:1, 16:9, 9:16) with the chosen model and checks each one came out in the shape that was asked for. Replicate charges for the three images.</p>}
    </div>
  );
}

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
    <>
    <TestShapes models={models.filter((m) => m.kind === "image")} />
    <div className="c" style={{ gap: 8, margin: "0 0 12px" }}>
      <button className="btn btn-s" onClick={run} disabled={Boolean(busy)}>{busy ? `Checking ${state.i} of ${state.total}: ${state.name}` : "Check that every model still runs"}</button>
      {state?.done ? <p className={`sm ${state.dead.length || state.unclear.length ? "bad" : "ok"}`} role="status">{state.dead.length ? `Discontinued: ${state.dead.join(", ")}.` : "Every model that answered is running."}{state.unclear.length ? ` No clear answer for: ${state.unclear.join(", ")}. Reload the page to see what Replicate said about each.` : ""}</p>
        : <p className="sm t3">Nothing is generated and nothing is charged. While the Replicate balance is under $5 it takes about 10 seconds per model.</p>}
    </div>
    </>
  );
}
