-- DEV ONLY: reset tables so new columns exactly match spec
DROP TABLE IF EXISTS seekers CASCADE;
DROP TABLE IF EXISTS retainers CASCADE;

CREATE TABLE seekers (
  id SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  company_dba         TEXT,
  birthday            DATE,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  zip                 TEXT NOT NULL,
  years_in_business   INTEGER,
  delivery_verticals  TEXT[] DEFAULT '{}',
  vehicle             TEXT,
  insurance           TEXT,
  ref1_name           TEXT,
  ref1_phone          TEXT,
  ref1_email          TEXT,
  ref1_company        TEXT,
  ref2_name           TEXT,
  ref2_phone          TEXT,
  ref2_email          TEXT,
  ref2_company        TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retainers (
  id SERIAL PRIMARY KEY,
  company             TEXT NOT NULL,
  ceo                 TEXT NOT NULL,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  zip                 TEXT NOT NULL,
  mission             TEXT,
  employees           INTEGER,
  delivery_verticals  TEXT[] DEFAULT '{}',
  desired_traits      TEXT[] DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

