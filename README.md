# pixelpulse

## Analytics & error monitoring

Everything works without any extra account.

**Setup**
1. Run `supabase/migrations/011_analytics_monitoring.sql` in the Supabase SQL Editor (safe to run more than once).
2. Vercel dashboard → project → **Analytics** → Enable (Web Analytics), and **Speed Insights** → Enable. Without this the
   `<Analytics/>` / `<SpeedInsights/>` scripts load but nothing is collected by Vercel. First-party analytics below works either way.
3. Open `/admin` (admin key), then `/admin/stats`.

**First-party funnel (Supabase `analytics_events`)** — `lib/analytics.js`, `app/telemetry.js`, `POST /api/track`
- Events: `landing_view`, `prompt_typed`, `generate_click` / `generation_success` / `generation_fail` (mode = image | video |
  effects | edit | facelock | animate), `signup_start`, `signup_complete`, `pricing_view`, `checkout_click`, and server-side
  `purchase` / `refund` from the Lemon Squeezy webhook (amount in cents).
- Only whitelisted short props are stored. No prompts, emails, user ids or raw IPs. `anon_id` = HMAC(day | IP | user agent),
  rotating daily. Admin visits are not counted. `/api/track` is rate limited (120 events / 10 min per hashed IP).
- The same events are also sent to Vercel custom events (`track()`), which Vercel only records on the **Pro** plan.

**Errors (Supabase `error_log`)** — `lib/monitor.js`, `lib/errorCore.js`, `POST /api/log-error`
- Browser: `window.onerror`, `unhandledrejection`, `app/error.js`, `app/global-error.js`.
- Server: API routes are wrapped with `withErrorLog(route, handler)` (thrown errors and 5xx responses except 503).
- Deduped by fingerprint (route + normalised message + top stack frame) with `count`, `first_seen`, `last_seen`.
  Messages are scrubbed of emails, IPs, tokens and URL query strings.
- Retention (daily cron `/api/cron/sweep`): analytics 400 days, errors 90 days after last seen.

**Optional: Sentry later** (not installed). `npm i @sentry/nextjs`, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel,
run the Sentry Next.js wizard, then call `Sentry.captureException(err)` at the "Sentry hook point" in `lib/monitor.js`
(`reportError`) and in `app/telemetry.js` (`reportClientError`). The Supabase error log can stay on alongside it.
