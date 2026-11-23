-- Additive migration for private Leonardo Ads history and human-reviewed recommendations.
-- Run against the dedicated SMEZI Content Engine D1 database only.
CREATE TABLE IF NOT EXISTS meta_ads_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner TEXT NOT NULL,
 account_id TEXT NOT NULL,
 period_days INTEGER NOT NULL,
 range_start TEXT NOT NULL,
 range_end TEXT NOT NULL,
 payload TEXT NOT NULL,
 collected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS meta_ads_snapshots_recent ON meta_ads_snapshots(owner,period_days,id DESC);
CREATE TABLE IF NOT EXISTS meta_ads_reviews (
 id TEXT NOT NULL,
 owner TEXT NOT NULL,
 campaign_id TEXT NOT NULL,
 title TEXT NOT NULL,
 explanation TEXT NOT NULL,
 evidence TEXT NOT NULL,
 proposed_action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL,
 reviewed_at TEXT,
 PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS meta_ads_reviews_recent ON meta_ads_reviews(owner,created_at DESC);
