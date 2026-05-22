CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS responses_created_at_idx
  ON responses (created_at);
