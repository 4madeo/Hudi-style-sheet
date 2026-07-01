create extension if not exists "pgcrypto";

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text,
  wallet_address text,
  twitter_handle text,
  followed_x boolean not null default false,
  joined_telegram boolean not null default false,
  referral_code text not null unique,
  referred_by_code text references waitlist_signups(referral_code) on delete set null,
  position bigserial not null,
  ip_country text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_signups_email_or_wallet_required check (email is not null or wallet_address is not null)
);

create unique index if not exists waitlist_signups_email_unique
  on waitlist_signups(email)
  where email is not null;

create unique index if not exists waitlist_signups_wallet_address_unique
  on waitlist_signups(wallet_address)
  where wallet_address is not null;

create index if not exists idx_waitlist_referred_by on waitlist_signups(referred_by_code);
create index if not exists idx_waitlist_position on waitlist_signups(position);
create index if not exists idx_waitlist_created_at on waitlist_signups(created_at);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_waitlist_signups_updated_at on waitlist_signups;
create trigger trg_waitlist_signups_updated_at
  before update on waitlist_signups
  for each row execute function set_updated_at();

create or replace view waitlist_referral_counts as
  select referred_by_code as code, count(*)::int as referrals
  from waitlist_signups
  where referred_by_code is not null
  group by referred_by_code;

alter table waitlist_signups enable row level security;
