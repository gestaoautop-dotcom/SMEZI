-- Additive only: use a NEW dedicated D1 database, never an existing customer database.
CREATE TABLE IF NOT EXISTS records (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, collection TEXT NOT NULL,
 id TEXT NOT NULL, root_id TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL,
 created_at TEXT NOT NULL, UNIQUE(owner, collection, id)
);
CREATE INDEX IF NOT EXISTS records_owner ON records(owner,collection,seq);
CREATE TABLE IF NOT EXISTS approvals (
 owner TEXT NOT NULL, record_id TEXT NOT NULL, digest TEXT NOT NULL, approved_at TEXT NOT NULL,
 PRIMARY KEY(owner,record_id)
);
CREATE TABLE IF NOT EXISTS connections (
 owner TEXT NOT NULL, provider TEXT NOT NULL, account_id TEXT NOT NULL, label TEXT NOT NULL,
 encrypted_token TEXT NOT NULL, expires_at INTEGER NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,provider)
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, record_id TEXT NOT NULL, root_id TEXT NOT NULL,
 provider TEXT NOT NULL, account_id TEXT NOT NULL, snapshot TEXT NOT NULL, digest TEXT NOT NULL,
 scheduled_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 container_id TEXT, remote_id TEXT, error TEXT, updated_at TEXT NOT NULL,
 UNIQUE(owner,record_id)
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,scheduled_at);
CREATE TABLE IF NOT EXISTS clients (
 id TEXT NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 stage TEXT NOT NULL, source_post_id TEXT NOT NULL DEFAULT '', project TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner,id)
);
CREATE TABLE IF NOT EXISTS client_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, client_id TEXT NOT NULL,
 payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_limits (
 owner TEXT NOT NULL, kind TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner,kind,bucket)
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, action TEXT NOT NULL,
 record_id TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, job_id TEXT NOT NULL,
 payload TEXT NOT NULL, collected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tracked_links (
 token TEXT PRIMARY KEY, owner TEXT NOT NULL, record_id TEXT NOT NULL, target TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS click_counts (
 token TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(token,day)
);

CREATE TABLE IF NOT EXISTS scheduler_heartbeat (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL);
