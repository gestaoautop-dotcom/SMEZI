# Deployment checklist — Leonardo Conversations
## Worker provisioning
Use the GitHub-connected Worker named `leonardo-conversations-consumer`:
- Build command: `npm install --no-audit --no-fund`
- Deploy command: `npx wrangler deploy --config wrangler.conversations.jsonc`
- Preview builds: off initially.
- Select the Cloudflare-created build token for this Worker, **not** an unrelated project token.
- Cloudflare Workers Builds starts from repository default branch. After the Worker exists, change **Settings > Build > Branch control** to `feature/leonardo-conversations-phase1`. Rebuild from that branch. Do not change the GitHub repository default.
- The Wrangler config intentionally has **no queue consumer subscription yet**. Do not add a consumer before D1, secrets and migrations are configured.
## D1 database setup
- In Leonardo Pages > Settings > Bindings identify the existing `DB` D1 database (do not create a second database).
- Apply `migrations/0003_conversations_phase1.sql` to the same D1 database via authorized Wrangler session or Cloudflare D1 console.
- In Worker Settings > Bindings, add D1 binding named `DB` pointing to that existing database.
- In Worker Settings > Variables and Secrets, add **secret** `TOKEN_ENCRYPTION_KEY` equal to the existing Leonardo encryption key (never put it in Git or screenshots). Add `GITHUB_ALLOWED_ID` and `META_API_VERSION` consistent with existing app. Set `CONVERSATIONS_TEST_ACCOUNT_ID` only after verifying Instagram account asset.
- Leave `CONVERSATIONS_AUTO_REPLY_ENABLED=false` until the messaging grant and test consent are confirmed.
## Producer
- In Pages project `smezi-content-engine`, configure Queue Producer binding: `CONVERSATIONS_QUEUE` -> `leonardo-conversations`. Cloudflare Pages supports producer bindings in Settings > Bindings, on Production and Preview separately.
- Add secret `META_WEBHOOK_VERIFY_TOKEN` (random) for webhook GET handshake, retain `META_APP_SECRET` for signature check. Set same token in Meta callback verification.
- After reviewing PR and authorizing release, deploy the Pages code containing `/api/webhooks/meta` and verify signature rejection and challenge response.
## Consumer
- Only after D1 binding, migration, secrets and test permissions are ready, go to Queues > leonardo-conversations > Consumers > Add Consumer > Worker and choose `leonardo-conversations-consumer`.
- Use batch size 1 for first test, retries 1, and monitor logs. Avoid inserting real messages until fully configured.
- Validate inbound event status in D1 and confirm actual message delivery, then (and only then) set `CONVERSATIONS_AUTO_REPLY_ENABLED=true` for the isolated test.
## Caveats
- The Meta account's existing publishing permission **does not** authorize messaging. Obtain required messaging permission and reconnect.
- A Pages preview URL cannot substitute for production webhook until the chosen callback is accessible and Meta-verifiable.
- Never log tokens, identifiers or raw message payloads.
