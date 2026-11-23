# Leonardo — OpenAI, Google Gemini and xAI (official APIs)

This module is additive to the existing Workers AI implementation. It provides manual prompts in `/ai-lab.html`, not autonomous publishing, social messaging, payment or tool execution.

## Deployment
1. Review and merge/test the feature branch under the normal Leonardo release procedure; do not replace the existing Cloudflare Pages project.
2. In Cloudflare Pages > Settings > Variables and Secrets, set server-only secrets for the desired providers:
   - `OPENAI_API_KEY` — https://platform.openai.com/api-keys
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey
   - `XAI_API_KEY` — https://console.x.ai/
3. Set the server-only model names to models enabled for the corresponding accounts: `OPENAI_MODEL`, `GEMINI_MODEL`, `XAI_MODEL`. Do not assume the model is available or free; confirm with each provider.
4. Keep `LEONARDO_EXTERNAL_AI_ENABLED=false` until billing and budgets are approved.
5. After validating available credits and provider-side spending limits, set `LEONARDO_EXTERNAL_AI_ENABLED=true` and `LEONARDO_AI_ALLOWED_PROVIDERS=gemini` (or a comma-separated subset such as `openai,gemini,xai`).
6. Authenticate to Leonardo and open `/ai-lab.html`. The page calls `GET /api/ai/providers` to report configuration safely, then `POST /api/ai/ask` for a single manual prompt.

## API
`POST /api/ai/ask` JSON: `{"provider":"gemini","prompt":"Olá"}`.
Requires Leonardo session, same-origin protection, provider allowlist, explicit activation and a per-owner D1 quota of 10 requests/provider/day. Calls are bounded to 8k input chars and 512 max output tokens; responses are not persisted by Leonardo. Error responses do not include upstream API response bodies.

## Financial & privacy warnings
- ChatGPT/Gemini/Grok consumer subscriptions are **not** API credit. Each provider may charge for API tokens; pricing and free tiers can change. No external AI calls run until flags and secrets are configured.
- The D1 daily quota is a request cap, **not a currency spending cap**. Configure provider billing limits separately. An ambiguous network failure can consume tokens even if Leonardo shows an error.
- Prompts are transmitted to the chosen provider and subject to its data handling policy. Do not send client personal data or confidential information without lawful basis, appropriate terms and consent/notice under LGPD.
- OpenAI requests set `store:false`. Do not assume this overrides all provider retention. xAI and Gemini requests have their own retention rules. Review vendor DPA and data controls before production.
- Never insert API keys into the browser, GitHub source, public logs or `ai-lab.html`.
- This is a manual test interface, not yet a conversation memory orchestrator or automatic fallback.
