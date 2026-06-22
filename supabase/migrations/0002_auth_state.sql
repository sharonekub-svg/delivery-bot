-- 10Bis login is SMS one-time-code (not password). We need to hold the user's
-- login email and the short-lived "pending" challenge between the
-- request-code and verify-code steps. Both are encrypted by the app.

create table if not exists auth_state (
  user_id uuid primary key references users(id) on delete cascade,
  tenbis_email text,
  pending_login text,
  updated_at timestamptz not null default now()
);

alter table auth_state enable row level security;

-- Carry the dish's menu category through to order execution (10Bis needs it
-- when adding the dish to the cart).
alter table orders add column if not exists category_id text;
