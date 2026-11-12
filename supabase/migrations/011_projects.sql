-- PixelPulse 011: projects (folders) in the Library.
-- Only adds things: one new table and one new, empty column. Nothing that exists is changed or removed.
-- Safe to run more than once. Service-role only (RLS on, no policies), like the other tables.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  creator_id  text not null,                      -- the owner, same id as images.creator_id
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists projects_creator_idx on public.projects (creator_id, created_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;

-- Which project an image or video is in. Empty (null) for everything that exists today.
-- Deleting a project empties this column for its items; the items themselves stay.
alter table public.images
  add column if not exists project_id uuid null references public.projects(id) on delete set null;
create index if not exists images_project_idx on public.images (project_id, created_at desc) where project_id is not null;
