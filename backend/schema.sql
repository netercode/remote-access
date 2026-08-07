-- Safety Sweep backend schema
-- Run with: psql -U <user> -d safety_sweep -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One safety wallet per user. Changing `address` is only ever done through
-- an authenticated request (see routes/safetyWallet.ts) -- there is no
-- code path that reaches this table without a valid login session.
CREATE TABLE IF NOT EXISTS safety_wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The emergency link's raw bearer token is never stored -- only a SHA-256
-- hash of it, the same way a password would be. Only one link per user is
-- active (revoked_at IS NULL) at a time; regenerating revokes the old one.
CREATE TABLE IF NOT EXISTS emergency_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_links_user ON emergency_links(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_links_active
  ON emergency_links(user_id) WHERE revoked_at IS NULL;
