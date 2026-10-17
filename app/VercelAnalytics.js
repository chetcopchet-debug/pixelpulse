"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Strip query strings (sign-in codes, tokens, ids) from page URLs before they reach Vercel; keep utm_* only.
export function stripUrl(url) {
  try {
    const u = new URL(url);
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (/^utm_(source|medium|campaign)$/.test(k)) keep.set(k, v.slice(0, 60));
    u.search = keep.toString(); u.hash = "";
    return u.toString();
  } catch { return url; }
}

export default function VercelAnalytics() {
  const clean = (e) => (e.url.includes("/admin") ? null : { ...e, url: stripUrl(e.url) });
  return <><Analytics beforeSend={clean} /><SpeedInsights beforeSend={clean} /></>;
}
