-- SMEZI AI Sales Agent | Cloudflare D1
CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, name TEXT,
 company TEXT, service_interest TEXT, status TEXT NOT NULL DEFAULT 'new',
 human_required INTEGER NOT NULL DEFAULT 0,
 consent_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversations (
 id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'whatsapp',
 direction TEXT NOT NULL, body TEXT NOT NULL,
 external_message_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_date ON conversations(lead_id,created_at);
CREATE TABLE IF NOT EXISTS proposals (
 id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, title TEXT NOT NULL,
 scope_json TEXT NOT NULL DEFAULT '{}', currency TEXT NOT NULL DEFAULT 'BRL',
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(lead_id) REFERENCES leads(id)
);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, provider TEXT NOT NULL,
 provider_reference TEXT UNIQUE, amount_cents INTEGER NOT NULL,
 currency TEXT NOT NULL DEFAULT 'BRL', status TEXT NOT NULL DEFAULT 'pending',
 confirmed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(proposal_id) REFERENCES proposals(id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
 subject_type TEXT NOT NULL, subject_id TEXT NOT NULL,
 details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
