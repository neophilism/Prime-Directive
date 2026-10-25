CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS graphs (
  workspace_id TEXT PRIMARY KEY, id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES graphs(workspace_id),
  label TEXT NOT NULL, name TEXT, name_claim_id TEXT,
  specialty TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('idle','working','paused','retired')),
  created_at TEXT NOT NULL, simulation INTEGER NOT NULL CHECK(simulation = 1),
  CHECK(name IS NULL AND name_claim_id IS NULL)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES graphs(workspace_id),
  worker_id TEXT NOT NULL REFERENCES workers(id), task_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('running','completed','cancelled')),
  started_at TEXT NOT NULL, ended_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_worker_run ON runs(worker_id) WHERE state='running';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_task_run ON runs(workspace_id,task_id) WHERE state='running';
CREATE TABLE IF NOT EXISTS activity_events (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES graphs(workspace_id), worker_id TEXT NOT NULL REFERENCES workers(id),
  task_id TEXT, run_id TEXT REFERENCES runs(id), kind TEXT NOT NULL,
  summary TEXT NOT NULL, evidence TEXT NOT NULL, occurred_at TEXT NOT NULL,
  simulation INTEGER NOT NULL CHECK(simulation = 1)
);
CREATE INDEX IF NOT EXISTS events_by_workspace ON activity_events(workspace_id,cursor);
CREATE TABLE IF NOT EXISTS experience (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES graphs(workspace_id),
  worker_id TEXT NOT NULL REFERENCES workers(id), run_id TEXT NOT NULL REFERENCES runs(id),
  command_fingerprint TEXT NOT NULL, body TEXT NOT NULL,
  UNIQUE(workspace_id,run_id)
);
CREATE INDEX IF NOT EXISTS experience_by_worker ON experience(workspace_id,worker_id);
