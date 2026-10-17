-- PixelPulse 010: server-side video jobs, private quarantine + temp-upload buckets, missing index.
-- Safe to run more than once. Requires 003 and 009. Tables are service-role only (RLS on, no policies).

-- 1) Video jobs: the webhook / poll / daily sweep save the video or refund the credits exactly once.
create table if not exists public.video_jobs (
  pred_id     text primary key,
  uid         text not null,
  source_id   uuid,
  cost        integer not null default 0,     -- paid credits charged (refunded on failure)
  effect      text,
  t2v_model   text,
  prompt      text,
  ratio       text,
  status      text not null default 'processing' check (status in ('processing','saving','done','refunded')),
  image_id    uuid,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists video_jobs_open_idx on public.video_jobs (created_at) where status in ('processing','saving');
create index if not exists video_jobs_uid_idx on public.video_jobs (uid, created_at desc);
alter table public.video_jobs enable row level security;
revoke all on public.video_jobs from anon, authenticated;

-- 2) Lookup by storage path (video poll, takedown). Not unique, so it never fails on legacy duplicates.
create index if not exists images_storage_path_idx on public.images (storage_path);

-- 3) Private buckets. quarantine: removed content kept as evidence (never public). uploads-tmp: raw phone photos
--    before conversion, max 8MB, images only; files older than 1h are deleted by /api/cron/sweep.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quarantine', 'quarantine', false, null, null)
on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads-tmp', 'uploads-tmp', false, 8388608,
        array['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 4) Where a removed item's files are held (null = still in the public bucket).
alter table public.images add column if not exists quarantine_path text;

-- 5) One-time prune of old rate-limit rows (the daily cron keeps it small from now on).
delete from public.usage_counters where day < current_date - 2;
