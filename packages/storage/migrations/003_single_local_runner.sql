CREATE TABLE runner_leadership (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  runner_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  lease_expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_runner_leadership_expiry
ON runner_leadership(lease_expires_at);
