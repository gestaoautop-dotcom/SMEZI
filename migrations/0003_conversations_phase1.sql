-- Applies to the existing Leonardo D1 database. No destructive changes.
CREATE TABLE IF NOT EXISTS conversation_webhook_events (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 channel_account_id TEXT NOT NULL,
 sender_id TEXT NOT NULL,
 received_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('received','disabled','blocked','missing_permission','expired_token','sending','sent','uncertain')),
 sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversation_events_owner_time ON conversation_webhook_events(owner,received_at);
