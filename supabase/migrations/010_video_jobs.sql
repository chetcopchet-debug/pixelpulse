-- PixelPulse 010: video jobs kept on the server, so a finished video is saved (or a failed one refunded)
-- even if the browser tab was closed. Safe to run more than once. Service-role only (RLS on, no policies).
create table if not exists public.video_jobs (
  prediction_id text primary key,            -- Replicate prediction id
  uid           text not null,               -- creator id that was charged
  source_id     uuid null,                   -- source image (Animate / Effects), null for text-to-video
  cost          integer not null default 0,  -- paid credits charged (refunded once if the run fails)
  kind          text not null,               -- animate | effect:<id> | video:<model>
  prompt        text,
  aspect_ratio  text,
  status        text not null default 'processing',  -- processing | done | failed
  image_id      uuid null,                   -- the saved video's row in images
  error         text,
  refunded      boolean not null default false,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists video_jobs_uid_idx on public.video_jobs (uid, created_at desc);
create index if not exists video_jobs_pending_idx on public.video_jobs (created_at) where status = 'processing';
alter table public.video_jobs enable row level security;
revoke all on public.video_jobs from anon, authenticated;
