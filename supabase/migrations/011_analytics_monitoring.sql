-- PixelPulse 011: first-party product analytics + error monitoring (no external account needed).
-- Safe to run more than once. Service-role only (RLS on, no policies, no grants to anon/authenticated).
-- Privacy: no raw IPs, no emails, no prompts. anon_id is a one-way hash that rotates every day (UTC),
-- so a visitor can't be followed across days.

create table if not exists public.analytics_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  name           text not null,          -- landing_view | prompt_typed | generate_click | generation_success | ...
  mode           text,                   -- image | video | effects | edit | facelock | animate (when relevant)
  anon_id        text,                   -- daily-rotating HMAC (never an IP / user id)
  source         text not null default 'client', -- client | server
  props          jsonb not null default '{}'::jsonb, -- small whitelisted values only
  revenue_cents  integer,                -- purchase / refund events only (refund is negative)
  currency       text
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at desc);
alter table public.analytics_events enable row level security;

-- One row per distinct error (fingerprint); repeats bump count + last_seen.
create table if not exists public.error_log (
  fingerprint  text primary key,
  source       text not null,            -- client | server
  route        text,
  message      text,
  stack        text,
  release      text,
  count        integer not null default 1,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create index if not exists error_log_last_seen_idx on public.error_log (last_seen desc);
alter table public.error_log enable row level security;

revoke all on public.analytics_events, public.error_log from anon, authenticated;

create or replace function public.log_error(p_fp text, p_source text, p_route text, p_message text, p_stack text, p_release text)
returns integer language sql as $$
  insert into public.error_log as e (fingerprint, source, route, message, stack, release)
  values (left(p_fp, 64), left(p_source, 10), left(p_route, 120), left(p_message, 500), left(p_stack, 2000), left(p_release, 40))
  on conflict (fingerprint) do update
    set count = e.count + 1, last_seen = now(), message = excluded.message,
        stack = coalesce(excluded.stack, e.stack), release = coalesce(excluded.release, e.release)
  returning count;
$$;

-- Daily aggregates for /admin/stats (UTC days).
create or replace function public.analytics_daily(p_since timestamptz)
returns table (day date, name text, mode text, events bigint, uniques bigint, revenue_cents bigint)
language sql stable as $$
  select (created_at at time zone 'utc')::date, name, mode, count(*), count(distinct anon_id), coalesce(sum(revenue_cents), 0)
  from public.analytics_events where created_at >= p_since
  group by 1, 2, 3;
$$;

-- Server-side truth for generations (generation_log from migration 009).
create or replace function public.generation_daily(p_since timestamptz)
returns table (day date, mode text, moderation text, n bigint)
language sql stable as $$
  select (created_at at time zone 'utc')::date, mode, coalesce(moderation, 'unknown'), count(*)
  from public.generation_log where created_at >= p_since
  group by 1, 2, 3;
$$;

revoke all on function public.log_error(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.analytics_daily(timestamptz) from public, anon, authenticated;
revoke all on function public.generation_daily(timestamptz) from public, anon, authenticated;
