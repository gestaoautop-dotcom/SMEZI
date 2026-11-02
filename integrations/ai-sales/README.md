# SMEZI | AI Sales Agent (integration starter)

This folder contains a separate Cloudflare Worker backend starter for a SMEZI sales assistant. It has NOT been deployed and is NOT yet wired into an existing SMEZI admin frontend.

## Architecture
- Meta WhatsApp Cloud API -> verified webhook -> Cloudflare Worker -> Cloudflare D1
- Optional OpenAI Responses API for customer qualification
- Admin-only endpoints using ADMIN_API_TOKEN
- Manual handoff / pause of bot replies
- Leads, conversations, proposals, payments (record-keeping only), audit log

## Deployment prerequisites
1. Create a Cloudflare D1 database, then replace REPLACE_WITH_D1_DATABASE_ID in wrangler.toml.
2. Run SQL migrations using the Cloudflare Wrangler CLI against the D1 database.
3. Set secrets with Wrangler: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, META_APP_SECRET, OPENAI_API_KEY, ADMIN_API_TOKEN.
4. Configure Meta WhatsApp Cloud API webhook URL and verification. Production messaging requires appropriate WhatsApp Business setup, opt-in and approved templates for business-initiated/out-of-window messages.
5. Deploy Worker from this folder after testing in a non-production environment.
6. Integrate admin endpoints via a server-side session/authentication layer. Do not expose ADMIN_API_TOKEN to the browser.
7. Add a payment-provider integration that verifies signed webhooks before marking any payment as paid.

## Important boundaries
- This starter does not collect payments, generate payment links, auto-create websites or send proposals automatically.
- The /api/payments route is read-only. Only real, verified payment events should change payment statuses.
- Request validation, administrative authorization with scoped user roles, rate limiting, WhatsApp retry processing, privacy notice/consent enforcement, data deletion/export, observability, and production tests should be completed before enabling live traffic.
- Set your real prices, service catalog, sales limits, escalation rules and customer privacy policy before launch.
- Do not put API secrets in GitHub.
