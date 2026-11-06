# Leonardo Conversations — Fase 1 (Instagram)
This feature reuses the existing Cloudflare Pages app, D1, Meta app, encrypted Instagram connection and GitHub login. No separate Supabase project.
## Meta callback
https://smezi-content-engine.pages.dev/api/webhooks/meta
GET handshake uses META_WEBHOOK_VERIFY_TOKEN. Every POST requires X-Hub-Signature-256 using META_APP_SECRET.
## Deploy sequence (do not enable automatic replies before review)
1. Apply migration to the existing D1: `npx wrangler d1 execute <D1_DATABASE_NAME> --remote --file=migrations/0003_conversations_phase1.sql`.
2. Create queue: `npx wrangler queues create leonardo-conversations`.
3. In Cloudflare Pages, bind producer queue as `CONVERSATIONS_QUEUE` to `leonardo-conversations`.
4. Build/deploy Pages from the feature branch after reviewing this change. Configure Production secret `META_WEBHOOK_VERIFY_TOKEN` as a long random value, and retain existing `META_APP_SECRET`.
5. Create a separate queue-consumer Worker with `workers/conversations-consumer.mjs` as entrypoint. Bind the existing D1 as `DB` and set the queue `leonardo-conversations` as its consumer. Set `GITHUB_ALLOWED_ID`, `TOKEN_ENCRYPTION_KEY`, `META_API_VERSION` and `CONVERSATIONS_TEST_ACCOUNT_ID` as appropriate. Store secret encryption key only in Worker secrets.
6. In the Meta app, set callback above, matching verify token and subscribe to the messaging event field for the applicable Instagram/Page product and login variant.
7. Before enabling replies, obtain messaging-specific permissions for the app and reconnect the Instagram account so its encrypted grant includes that permission. Existing content-publishing OAuth alone is **not** enough.
8. For a controlled test, set `CONVERSATIONS_AUTO_REPLY_ENABLED=true` and `CONVERSATIONS_TEST_REPLY=Olá! Esta é uma mensagem de teste do Leonardo.` in the consumer Worker only. Outside this test the flag must remain false.
9. Test an inbound DM from an eligible test account and inspect `conversation_webhook_events` status through D1; check delivery in Instagram.
## Guardrails
- The webhook is intentionally public; it bypasses the private GitHub session but verifies every POST with Meta HMAC.
- It acknowledges only successful queue insertion; disabled sending still records an inbound event.
- Duplicates are suppressed by message id. Ambiguous Meta sends are marked uncertain, **never blindly retried**.
- No message contents or tokens are stored in the Phase 1 event table or logs.
- No automatic replies to comments, stories or Messenger yet; Phase 1 only recognizes inbound text DMs.
- Verify the current messaging permissions, API endpoint and Meta app review requirements for the specific selected Meta login product prior to enabling the reply feature.
- Queue retention, Free plan usage and provider pricing must be reviewed before production-scale use.
