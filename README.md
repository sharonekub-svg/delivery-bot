# 🍽️ Food Order Helper

A WhatsApp conversational assistant that proactively orders a healthy lunch on
**10Bis** so you never skip a meal. Built per the PRD (executive summary →
onboarding → daily engagement → recommendation engine → autopilot → budget →
security).

> Status: **scaffold complete and building/green**. Runs end-to-end today against
> a *mock* 10Bis. The one piece that needs your input is the real **10Bis local
> API** — see [What's left](#whats-left).

## Architecture

```
WhatsApp ──webhook──► Vercel (Next.js API routes) ──► Supabase (Postgres)
   ▲                         │                          users / preferences
   │ replies                 ├──► 10Bis client (mock | local)  orders / tokens(enc)
   └─────────────────────────┤
                             └──► Vercel Cron ──► recommendation engine ──► daily prompt
```

| Concern | Choice |
|---|---|
| Hosting / API | Next.js (Pages Router) on Vercel; serverless API routes |
| Scheduling | Vercel Cron (`vercel.json`) — daily prompt + autopilot sweep |
| Database | Supabase Postgres (`supabase/migrations/0001_init.sql`) |
| WhatsApp | Twilio WhatsApp (sandbox to start) |
| NL blurbs | Anthropic Claude (`ANTHROPIC_MODEL`) |
| Secrets | Vercel env vars; credentials AES-256-GCM encrypted at rest |

## Code map

```
src/
  tenbis/        the only seam to 10Bis: types, client interface, mock, local(REAL)
  domain/        types, preference defaults, recommendation engine + budget
  lib/           supabase, crypto (AES-256-GCM), config, claude, repo, cronAuth
  whatsapp/      twilio send, message templates, reply parser
  services/      dailyOrder, execOrder, autopilot, inbound (conversation router)
  pages/         onboarding + auth + terms webviews
  pages/api/     whatsapp/webhook, cron/daily, cron/autopilot, auth/credentials, onboarding
supabase/migrations/0001_init.sql
```

## How the PRD maps to code

- **Onboarding & ToS** → `pages/onboarding.tsx`, `pages/terms.tsx`, `whatsapp/templates.welcome`
- **11 preference attributes** → `domain/types.Preferences`, `domain/preferences.defaultPreferences`
- **Daily engagement / order execution** → `services/dailyOrder.ts`, `services/execOrder.ts`
- **On-demand menu commands** → `whatsapp/parser.ts`, `services/inbound.ts`
- **Recommendation engine (scoring + fatigue)** → `domain/recommendation.ts`
- **Autopilot intent-to-order + cancel window** → `services/autopilot.ts`
- **Budget over-allocation handling** → `domain/budget.ts`, `inbound` budget approval flow
- **Security: encryption + session expiry / re-auth** → `lib/crypto.ts`, `pages/auth.tsx`, `services/*` session checks

## Local dev

```bash
npm install
cp .env.example .env.local        # fill in values; TENBIS_CLIENT=mock works with no creds
npm run dev                       # http://localhost:3000
npm run typecheck && npm test     # tsc + vitest
```

## Deploy (Vercel)

1. Set the env vars from `.env.example` in the Vercel project.
2. Apply `supabase/migrations/0001_init.sql` to the Supabase project.
3. In the Twilio console → Messaging → WhatsApp sandbox settings, set the
   "When a message comes in" webhook to
   `https://<your-app>.vercel.app/api/whatsapp/webhook` (POST).
4. Cron is configured in `vercel.json` (daily Sun–Thu; autopilot every 5 min).

## What's left

1. **The 10Bis local API.** Implement `src/tenbis/local.ts` — every method has a
   `// NEED:` note for the exact endpoint/shape required. Then set
   `TENBIS_CLIENT=local` and `TENBIS_API_BASE_URL`. Nothing else needs to change.
2. **Secrets**: Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_WHATSAPP_FROM`), `ANTHROPIC_API_KEY` (optional), `CREDENTIALS_ENC_KEY`
   (`openssl rand -hex 32`), `CRON_SECRET`, Supabase URL + service-role key.
3. **Supabase project** (account is at the 2-free-project limit — pause/upgrade
   or reuse an existing one).

## Security notes

- 10Bis credentials are validated once and discarded; only the encrypted session
  token is stored (`food_app_tokens.encrypted_token`, AES-256-GCM).
- The encryption key lives only in env vars, never in git or the DB.
- Cron endpoints require `Authorization: Bearer $CRON_SECRET`; the WhatsApp
  webhook verifies the Twilio request signature in production.
- `npm audit` flags Next.js App-Router/image-optimizer DoS advisories (we use the
  Pages Router + API routes only) and dev-only vitest/vite issues. None affect the
  production runtime; revisit with a Next 15 / React 19 upgrade later if desired.
```
