"use client";
import { useEffect, useState } from "react";

// Finishes the sign-in that the emailed link or Google started, then opens the studio. The words arrive already
// in the visitor's language from the page around it.
export default function Callback({ words, english }) {
  const [state, setState] = useState({ busy: true, msg: words.busy });
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    const token = h.get("access_token");
    const code = q.get("code");
    const fail = (msg) => setState({ busy: false, msg });
    // What the sign-in service says arrives in English; other languages get our own sentence instead.
    const said = (msg, ours) => (english && msg ? msg : ours);
    if (!token && !code) { fail(said(q.get("error_description") || h.get("error_description"), words.old)); return; }
    history.replaceState(null, "", "/auth/callback");
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(code ? { code, oauth: true } : { access_token: token }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) window.location.replace("/?signedin=1"); else fail(said(d.error, words.failed)); })
      .catch(() => fail(words.offline));
  }, [words, english]);
  return (
    <div className="center" role="status">
      {state.busy ? <i className="spin" style={{ width: 28, height: 28 }} /> : null}
      <p className={state.busy ? "t2" : ""} style={{ fontSize: 17, lineHeight: "26px", maxWidth: 420 }}>{state.msg}</p>
      {state.busy ? null : <a className="btn btn-p" href="/?signin=1">{words.again}</a>}
    </div>
  );
}
