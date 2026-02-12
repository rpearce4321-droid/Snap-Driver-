PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_meetings (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  title TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);
