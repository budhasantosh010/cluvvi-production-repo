CREATE TABLE run_requests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start', 'resume', 'cancel')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  claimed_by TEXT,
  claimed_at TEXT,
  lease_expires_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  failure_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_run_requests_claim
ON run_requests(status, lease_expires_at, created_at);

CREATE INDEX idx_run_requests_run
ON run_requests(run_id, created_at);

CREATE TABLE runner_heartbeats (
  runner_id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  process_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE INDEX idx_runner_heartbeats_seen
ON runner_heartbeats(last_seen_at DESC);

CREATE TABLE local_runtime_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
