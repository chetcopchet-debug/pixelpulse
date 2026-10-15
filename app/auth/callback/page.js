"use client";
import { useEffect, useState } from "react";
export default function AuthCallback() {
  const [msg, setMsg] = useState("Signing you in…");
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    const token = h.get("access_token");
    const code = q.get("code");
    if (!token && !code) { setMsg(q.get("error_description") || h.get("error_description") || "This sign-in link is invalid or expired. Request a new one in the app."); return; }
    history.replaceState(null, "", "/auth/callback");
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(code ? { code, oauth: true } : { access_token: token }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) window.location.replace("/?signedin=1"); else setMsg(d.error || "Sign-in failed."); })
      .catch(() => setMsg("Sign-in failed. Try again."));
  }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070a", color: "#e9e7f5", fontFamily: "system-ui", padding: 24, textAlign: "center" }}><div><p>{msg}</p><a href="/" style={{ color: "#f0abfc" }}>Back to PixelPulse</a></div></main>;
}
