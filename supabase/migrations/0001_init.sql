-- Food Order Helper — initial schema.
-- WhatsApp phone is the primary unique identifier for a user (PRD §3.1).

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  whatsapp_phone text not null unique,
  display_name text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

-- One preference blob per user (the 11 attributes from PRD §3.2), stored as
-- JSONB so the shape can evolve without migrations.
create table if not exists preferences (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Encrypted 10Bis session token (PRD §4.4). We NEVER store raw credentials;
-- encrypted_token holds an AES-256-GCM ciphertext produced by the app.
create table if not exists food_app_tokens (
  user_id uuid primary key references users(id) on delete cascade,
  encrypted_token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  dish_id text not null,
  dish_name text not null,
  restaurant_id text not null,
  restaurant_name text not null,
  price_nis numeric not null,
  status text not null default 'suggested',
  tenbis_order_id text,
  tracker_deep_link text,
  execute_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_status_idx on orders (user_id, status);
create index if not exists orders_autopilot_idx on orders (status, execute_at);

-- RLS: all access is via the service-role key from server-side code only.
-- Enable RLS and add no public policies so the anon/public key cannot read
-- these tables (defence in depth — service role bypasses RLS).
alter table users enable row level security;
alter table preferences enable row level security;
alter table food_app_tokens enable row level security;
alter table orders enable row level security;
