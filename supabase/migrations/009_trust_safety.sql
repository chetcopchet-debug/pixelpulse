-- PixelPulse 009: trust & safety — structured reports, auto-takedown, strikes/bans, generation log.
-- Safe to run more than once. Requires 003. All tables are service-role only (RLS on, no policies).

-- Reports: structured reason code + optional details (existing image_reports keeps one row per reporter per image).
alter table public.image_reports add column if not exists reason_code text;
alter table public.image_reports add column if not exists details text;

-- Takedown state on images.
alter table public.images add column if not exists removed_at timestamptz;
alter table public.images add column if not exists removal_reason text;
alter table public.images add column if not exists first_reported_at timestamptz;
alter table public.images add column if not exists auto_checked_at timestamptz;
create index if not exists images_reported_idx on public.images (first_reported_at desc) where report_count > 0 or hidden;

-- Confirmed removals ("strikes"). Kept even if the image row is later deleted permanently.
create table if not exists public.moderation_strikes (
  image_id    uuid primary key,
  creator_id  text not null,
  source      text not null,             -- 'auto:nsfw' | 'admin:delete'
  created_at  timestamptz not null default now()
);
create index if not exists moderation_strikes_creator_idx on public.moderation_strikes (creator_id);
alter table public.moderation_strikes enable row level security;

create table if not exists public.banned_creators (
  creator_id  text primary key,
  reason      text,
  banned_at   timestamptz not null default now()
);
alter table public.banned_creators enable row level security;

-- Generation log: one row per generation attempt that reached a model (and text-blocked attempts).
create table if not exists public.generation_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  user_id      text,                      -- creator id (canonical uid for signed-in users)
  ip_hash      text,                      -- HMAC of the IP, never the raw IP
  mode         text not null,             -- generate | edit | facelock | repaint | amplify | animate | t2v | ...
  prompt       text,
  input_ref    text,                      -- source image id (if any)
  output_ref   text,                      -- stored image id / storage path (if any)
  moderation   text                       -- passed | blocked:text | blocked:output | failed | ...
);
create index if not exists generation_log_user_idx on public.generation_log (user_id, created_at desc);
create index if not exists generation_log_created_idx on public.generation_log (created_at desc);
alter table public.generation_log enable row level security;

revoke all on public.moderation_strikes, public.banned_creators, public.generation_log from anon, authenticated;
