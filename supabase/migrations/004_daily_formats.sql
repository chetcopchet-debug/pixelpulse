-- 004: Pulse Formats + Daily Pulse (entries, streaks, admin theme override). Safe to re-run.
alter table public.images add column if not exists format text;
alter table public.images add column if not exists daily_day date;
alter table public.images add column if not exists daily_theme text;
create index if not exists images_daily_idx on public.images (daily_day, likes desc) where is_public and not hidden and daily_day is not null;
create index if not exists images_format_idx on public.images (format, created_at desc) where is_public and not hidden;
create index if not exists images_remix_of_idx on public.images (remix_of);

create table if not exists public.daily_streaks (
  uid text primary key,
  last_day date not null,
  streak integer not null default 1,
  best integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.daily_streaks enable row level security;

create table if not exists public.daily_overrides (
  day date primary key,
  theme text not null check (char_length(theme) between 2 and 120),
  format text not null,
  created_at timestamptz not null default now()
);
alter table public.daily_overrides enable row level security;

-- Atomically record that a visitor joined the pulse on p_day. Returns the streak and whether this is the first join today.
create or replace function public.join_daily(p_uid text, p_day date)
returns table(streak integer, is_new boolean)
language plpgsql security definer set search_path = public as $$
declare r public.daily_streaks%rowtype; n integer;
begin
  insert into public.daily_streaks(uid, last_day, streak, best) values (p_uid, p_day, 1, 1)
  on conflict (uid) do nothing;
  if found then return query select 1, true; return; end if;
  select * into r from public.daily_streaks where uid = p_uid for update;
  if r.last_day >= p_day then return query select r.streak, false; return; end if;
  n := case when r.last_day = p_day - 1 then r.streak + 1 else 1 end;
  update public.daily_streaks set last_day = p_day, streak = n, best = greatest(best, n), updated_at = now() where uid = p_uid;
  return query select n, true;
end $$;

revoke all on function public.join_daily(text, date) from public, anon, authenticated;
revoke all on public.daily_streaks from anon, authenticated;
revoke all on public.daily_overrides from anon, authenticated;
