import { pool } from "./client";

const run = async (): Promise<void> => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL DEFAULT 30,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_status INTEGER,
      last_latency INTEGER,
      last_checked TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS monitor_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      status_code INTEGER,
      latency_ms INTEGER,
      ok BOOLEAN NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alert_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
    CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_id_checked_at ON monitor_checks(monitor_id, checked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  `);

  await pool.end();
  // eslint-disable-next-line no-console
  console.log("Database migrations complete");
};

void run();
