-- PixelPulse 012: remember which project a video was started in, so a video that finishes while the site is
-- closed still lands in that project.
-- Only adds one new, empty column. Nothing that exists is changed or removed. Safe to run more than once.
alter table public.video_jobs
  add column if not exists project_id uuid null references public.projects(id) on delete set null;
