-- PixelPulse 003: feed safety (reports / hide) + persistent usage counters & spend breaker.
-- Safe to run more than once.

alter table public.images add column if not exists hidden boolean not null default false;
alter table public.images add column if not exists report_count integer not null default 0;
create index if not exists images_public_visible_idx on public.images (created_at desc) where is_public and not hidden;

create table if not exists public.image_reports (
  image_id   uuid not null references public.images(id) on delete cascade,
  reporter   text not null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (image_id, reporter)
);
alter table public.image_reports enable row level security;

-- One report per reporter per image; auto-hides at p_threshold reports. Returns new count (null if duplicate/not public).
create or replace function public.report_image(p_image uuid, p_reporter text, p_reason text, p_threshold integer default 3)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from images where id = p_image and is_public) then return null; end if;
  insert into image_reports (image_id, reporter, reason) values (p_image, p_reporter, left(p_reason, 200))
    on conflict do nothing;
  if not found then return null; end if;
  update images set report_count = report_count + 1,
    hidden = hidden or (report_count + 1 >= p_threshold)
    where id = p_image returning report_count into n;
  return n;
end; $$;
revoke all on function public.report_image(uuid, text, text, integer) from public, anon, authenticated;

-- Daily counters (per-IP credits, global spend in USD).
create table if not exists public.usage_counters (
  key    text not null,
  day    date not null,
  amount numeric not null default 0,
  primary key (key, day)
);
alter table public.usage_counters enable row level security;

-- Atomically add p_amount if the result stays <= p_limit. Returns new total, or null if it would exceed.
-- Negative p_amount (refund) always applies, floored at 0.
create or replace function public.bump_usage(p_key text, p_day date, p_amount numeric, p_limit numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare cur numeric;
begin
  insert into usage_counters (key, day, amount) values (p_key, p_day, 0) on conflict do nothing;
  select amount into cur from usage_counters where key = p_key and day = p_day for update;
  if p_amount > 0 and cur + p_amount > p_limit then return null; end if;
  update usage_counters set amount = greatest(0, cur + p_amount) where key = p_key and day = p_day
    returning amount into cur;
  return cur;
end; $$;
revoke all on function public.bump_usage(text, date, numeric, numeric) from public, anon, authenticated;

-- Housekeeping: old counters are not needed.
delete from public.usage_counters where day < current_date - 7;
