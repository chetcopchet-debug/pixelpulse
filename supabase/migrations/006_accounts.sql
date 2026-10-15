-- PixelPulse 006: email accounts (Supabase Auth) -> canonical creator uid, and device->account merge. Safe to run more than once.
create table if not exists public.accounts (
  user_id    uuid primary key,          -- auth.users.id
  uid        uuid not null unique,      -- canonical creator id used by images / paid_credits / streaks
  email      text not null,
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now()
);
alter table public.accounts enable row level security;

-- Move everything owned by device uid p_from onto account uid p_to (atomic). Returns credits moved.
create or replace function public.merge_uid(p_from uuid, p_to uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare moved integer := 0; f text := p_from::text; t text := p_to::text;
begin
  if p_from = p_to then return 0; end if;
  update images set creator_id = t where creator_id = f;
  delete from image_likes l using image_likes k where l.creator_id = f and k.creator_id = t and k.image_id = l.image_id;
  update image_likes set creator_id = t where creator_id = f;
  select coalesce(balance, 0) into moved from paid_credits where uid = p_from for update;
  if coalesce(moved, 0) > 0 then
    insert into paid_credits (uid, balance) values (p_to, moved)
      on conflict (uid) do update set balance = paid_credits.balance + excluded.balance, updated_at = now();
    delete from paid_credits where uid = p_from;
  end if;
  update payment_events set uid = p_to where uid = p_from;
  -- keep the better streak
  if exists (select 1 from daily_streaks where uid = f) then
    insert into daily_streaks (uid, last_day, streak, best)
      select t, last_day, streak, best from daily_streaks where uid = f
      on conflict (uid) do update set
        last_day = greatest(daily_streaks.last_day, excluded.last_day),
        streak = case when excluded.last_day > daily_streaks.last_day then excluded.streak
                      when excluded.last_day = daily_streaks.last_day then greatest(daily_streaks.streak, excluded.streak)
                      else daily_streaks.streak end,
        best = greatest(daily_streaks.best, excluded.best), updated_at = now();
    delete from daily_streaks where uid = f;
  end if;
  return coalesce(moved, 0);
end; $$;
revoke all on function public.merge_uid(uuid, uuid) from public, anon, authenticated;
