"use client";
// Client analytics + error reporting. Never sends prompts, emails or raw ids.
// track(): Vercel Web Analytics custom event (counted only on Vercel Pro) + our own /api/track (works on any plan).
import { track as vercelTrack } from "@vercel/analytics";

const RELEASE = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const once = new Set();

function beacon(url, payload) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function track(name, props = {}) {
  if (typeof window === "undefined") return;
  const clean = {};
  for (const [k, v] of Object.entries(props || {})) if (v !== undefined && v !== null && v !== "") clean[k] = v;
  try { vercelTrack(name, clean); } catch {}
  beacon("/api/track", { name, props: clean });
}

// Fire an event at most once per page load (e.g. "first prompt typed").
export function trackOnce(name, props) {
  if (once.has(name)) return;
  once.add(name);
  track(name, props);
}

const sentErrors = new Set();
// Sentry hook point (optional): Sentry.captureException(err) here once @sentry/nextjs is installed (see README).
export function reportClientError(err, kind = "client") {
  if (typeof window === "undefined") return;
  try {
    const message = String(err?.message || err?.reason?.message || err || "Unknown error").slice(0, 500);
    const stack = String(err?.stack || err?.reason?.stack || "").slice(0, 3000);
    // Ignore noise from browser extensions and cross-origin scripts.
    if (/^Script error\.?$/i.test(message) || /chrome-extension:|moz-extension:|safari-extension:/i.test(stack)) return;
    const key = `${kind}|${message}`;
    if (sentErrors.has(key) || sentErrors.size >= 10) return;
    sentErrors.add(key);
    beacon("/api/log-error", { message, stack, kind, route: window.location.pathname, release: RELEASE || undefined });
  } catch {}
}
