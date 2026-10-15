create table if not exists public.referral_codes (code text primary key, uid uuid not null unique, ip_hash text, created_at timestamptz not null default now());
alter table public.referral_codes enable row level security;
create table if not exists public.referrals (referee_uid uuid primary key, referrer_uid uuid not null, ip_hash text not null unique, created_at timestamptz not null default now());
create index if not exists referrals_referrer_idx on public.referrals (referrer_uid, created_at desc);
alter table public.referrals enable row level security;
