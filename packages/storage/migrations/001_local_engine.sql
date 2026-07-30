CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  mission_name TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  input_json TEXT NOT NULL,
  source_file TEXT NOT NULL,
  config_json TEXT NOT NULL,
  budget_json TEXT NOT NULL,
  usage_json TEXT NOT NULL,
  failure_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  phase TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_run_events_run_created
ON run_events(run_id, created_at, id);

CREATE TABLE stage_executions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  stage_version TEXT NOT NULL,
  status TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failure_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_stage_executions_run_stage
ON stage_executions(run_id, stage_name, attempt);

CREATE UNIQUE INDEX idx_stage_executions_completed_fingerprint
ON stage_executions(run_id, stage_name, stage_version, input_fingerprint)
WHERE status = 'completed';

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  version INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, artifact_type, version),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_artifacts_run_type_version
ON artifacts(run_id, artifact_type, version DESC);

CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  cost_usd REAL NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  provider_request_id TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_tool_calls_run_created
ON tool_calls(run_id, created_at, id);

CREATE INDEX idx_tool_calls_reuse
ON tool_calls(request_fingerprint, status);

CREATE TABLE evaluation_labels (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  overall_label TEXT NOT NULL,
  worth_contacting INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
