"use client";
import { useEffect, useState } from "react";
import Page from "../../studio/Page";

// Where the emailed link and Google send people back to. Finishes the sign-in and opens the studio.
export default function AuthCallback() {
  const [state, setState] = useState({ busy: true, msg: "Signing you in…" });
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    const token = h.get("access_token");
    const code = q.get("code");
    const fail = (msg) => setState({ busy: false, msg });
    if (!token && !code) { fail(q.get("error_description") || h.get("error_description") || "This sign-in link is no longer valid. Ask for a new one."); return; }
    history.replaceState(null, "", "/auth/callback");
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(code ? { code, oauth: true } : { access_token: token }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) window.location.replace("/?signedin=1"); else fail(d.error || "Sign-in didn't work. Try again."); })
      .catch(() => fail("Sign-in didn't work. Check your connection and try again."));
  }, []);
  return (
    <Page bare>
      <div className="center" role="status">
        {state.busy ? <i className="spin" style={{ width: 28, height: 28 }} /> : null}
        <p className={state.busy ? "t2" : ""} style={{ fontSize: 17, lineHeight: "26px", maxWidth: 420 }}>{state.msg}</p>
        {state.busy ? null : <a className="btn btn-p" href="/?signin=1">Try again</a>}
      </div>
    </Page>
  );
}
