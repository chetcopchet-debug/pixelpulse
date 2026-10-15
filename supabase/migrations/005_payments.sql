-- PixelPulse 005: paid credit balance (Lemon Squeezy). Safe to run more than once.
create table if not exists public.paid_credits (
  uid        uuid primary key,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.paid_credits enable row level security;

-- Every processed webhook event (idempotency + audit).
create table if not exists public.payment_events (
  event_id   text primary key,
  uid        uuid not null,
  kind       text not null,
  credits    integer not null,
  order_id   text,
  email_hash text,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
create index if not exists payment_events_uid_idx on public.payment_events (uid, created_at desc);

create or replace function public.paid_balance(p_uid uuid)
returns integer language sql security definer set search_path = public stable as $$
  select coalesce((select balance from paid_credits where uid = p_uid), 0);
$$;

-- Atomic spend: returns new balance, or null if not enough.
create or replace function public.paid_spend(p_uid uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare b integer;
begin
  update paid_credits set balance = balance - p_amount, updated_at = now()
    where uid = p_uid and balance >= p_amount returning balance into b;
  return b;
end; $$;

-- Grant (or deduct with negative amount, clamped at 0). With p_event: idempotent, returns null if already processed.
create or replace function public.paid_grant(p_uid uuid, p_amount integer, p_event text default null, p_kind text default 'refund_internal', p_order text default null, p_email_hash text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare b integer;
begin
  if p_event is not null then
    insert into payment_events (event_id, uid, kind, credits, order_id, email_hash)
      values (p_event, p_uid, p_kind, p_amount, p_order, p_email_hash) on conflict do nothing;
    if not found then return null; end if;
  end if;
  insert into paid_credits (uid, balance) values (p_uid, greatest(0, p_amount))
    on conflict (uid) do update set balance = greatest(0, paid_credits.balance + p_amount), updated_at = now()
    returning balance into b;
  return b;
end; $$;

revoke all on function public.paid_balance(uuid) from public, anon, authenticated;
revoke all on function public.paid_spend(uuid, integer) from public, anon, authenticated;
revoke all on function public.paid_grant(uuid, integer, text, text, text, text) from public, anon, authenticated;
