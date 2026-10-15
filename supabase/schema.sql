-- PixelPulse shared feed + permanent storage
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

create table if not exists public.images (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  prompt        text not null,
  style         text,
  aspect_ratio  text,
  storage_path  text not null,
  public_url    text not null,
  is_public     boolean not null default false,
  creator_id    text not null,
  remix_of      uuid null references public.images(id) on delete set null,
  likes         integer not null default 0
);

create index if not exists images_public_created_idx on public.images (created_at desc) where is_public;
create index if not exists images_creator_created_idx on public.images (creator_id, created_at desc);
create index if not exists images_remix_of_idx on public.images (remix_of);

-- One like per anonymous creator per image
create table if not exists public.image_likes (
  image_id    uuid not null references public.images(id) on delete cascade,
  creator_id  text not null,
  created_at  timestamptz not null default now(),
  primary key (image_id, creator_id)
);

-- Atomic like: returns the new like count, or null if already liked / not public
create or replace function public.like_image(p_image uuid, p_creator text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if not exists (select 1 from images where id = p_image and is_public) then
    return null;
  end if;
  insert into image_likes (image_id, creator_id) values (p_image, p_creator)
    on conflict do nothing;
  if not found then
    return null;
  end if;
  update images set likes = likes + 1 where id = p_image returning likes into new_count;
  return new_count;
end;
$$;
revoke all on function public.like_image(uuid, text) from public, anon, authenticated;

-- Row Level Security: anyone may read public rows; all writes go through the
-- server using the service role key (which bypasses RLS).
alter table public.images enable row level security;
alter table public.image_likes enable row level security;

drop policy if exists "Public images are readable" on public.images;
create policy "Public images are readable" on public.images
  for select using (is_public = true);
-- (no insert/update/delete policies => denied for anon/authenticated)

-- Storage bucket (public read via public URL)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;
