-- PixelPulse 007: cloud favorites for signed-in accounts. Safe to run more than once.
create table if not exists public.favorites (
  uid        uuid not null,                                            -- account's canonical creator uid
  image_id   uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (uid, image_id)
);
create index if not exists favorites_uid_created_idx on public.favorites (uid, created_at desc);
alter table public.favorites enable row level security;  -- no policies: only the server (service role) reads/writes
