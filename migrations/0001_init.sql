-- D1 schema: initial core tables (auth + profiles + seed batches)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS seed_batches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seekers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  birthday TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retainers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  company_name TEXT NOT NULL,
  ceo_name TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  payment_terms TEXT,
  pay_cycle_close_day TEXT,
  pay_cycle_frequency TEXT,
  pay_cycle_timezone TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retainer_users (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  bio TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subcontractors (
  id TEXT PRIMARY KEY,
  seeker_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  bio TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  seeker_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  seeker_id TEXT NOT NULL,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS routes (
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

CREATE TABLE IF NOT EXISTS route_interests (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  seeker_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INTERESTED',
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES seekers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (retainer_id) REFERENCES retainers(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  icon_key TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS badge_selections (
  id TEXT PRIMARY KEY,
  owner_role TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  locked_until TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS badge_checkins (
  id TEXT PRIMARY KEY,
  badge_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  target_id TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reputation_scores (
  id TEXT PRIMARY KEY,
  owner_role TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  score_percent INTEGER NOT NULL,
  note TEXT,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS record_hall_entries (
  id TEXT PRIMARY KEY,
  owner_role TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  badge_id TEXT,
  value TEXT,
  delta INTEGER,
  data_json TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  seed_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (seed_batch_id) REFERENCES seed_batches(id) ON DELETE SET NULL
);
