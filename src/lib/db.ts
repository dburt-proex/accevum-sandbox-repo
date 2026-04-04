import Database from "better-sqlite3";

export const db = new Database("data.db");

// Create table on startup if it does not exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    lastStatus INTEGER,
    lastLatency INTEGER,
    lastChecked INTEGER
  )
`);
