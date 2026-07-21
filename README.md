# 🍽️ Lunch Helper

A **website + WhatsApp assistant** where you connect your **10Bis** account,
chat with a bot about how you like to eat, and it recommends — and orders —
your lunch.

## What's new in v2

- **Smarter recommendation engine** — beyond budget/protein/fatigue, it now
  scores taste match (your stated likes + favourite restaurants), 10Bis health
  signals (green badge, front-of-pack warnings), calories for low-carb goals,
  protein-per-shekel value, and rotates near-tied dishes daily so picks never
  feel stuck. Every pick carries Hebrew **reasons** ("עתיר חלבון", "בתוך
  התקציב") shown in the site and in WhatsApp.
- **Weekly meal plan** — `domain/weeklyPlan.ts` builds a budget-aware,
  no-repeats plan across your active days. Ask the WhatsApp bot with *שבוע*, or
  set the weekly planning horizon to get a preview at the start of each week.
- **WhatsApp bot speaks Hebrew** — the parser understands עברית ("כן",
  "דלג", "בטל", "עוד", "תפריט"…) alongside English, plus new commands: *עוד*
  (more options, numbering continues), *שבוע* (weekly plan), *תקציב* (monthly
  stats) / *תקציב 50* (set budget inline), *בלי גלוטן* (add an exclusion
  mid-chat), *הפסק*/*המשך* (pause/resume). Free text falls back to Claude to
  interpret intent ("בא לי לדלג היום" just works).
- **Site polish** — the lunch page explains each pick, has skeleton loading,
  refresh and "more options"; the chat page gained a free-text input that
  understands search, "בלי X" and "תקציב N" locally; buttons got
  micro-interactions and reduced-motion support.

The flow is dead simple:

1. **Connect** (`/connect`) — paste a single 10Bis request you copied from your
   browser's DevTools ("Copy as cURL"). No password. We extract the cookie +
   bearer token and validate them.
2. **Profile** (`/profile`) — we first read your 10Bis **order history** (recent
   orders, what your employer's monthly allowance is, what you order most, what
   you've barely touched) and pre-fill the form from *your real data* — nothing
   invented. You then tune: taste, goal, protein, favourites, allergies, budget,
   the **time window and days** to order on (work-days presets), and can connect
   a **calendar** (paste a Google Calendar iCal link) so delivery is timed into a
   gap with no meeting. We also greet you by name, surface your **available
   coupons**, and expose every order option 10Bis supports — pickup vs delivery,
   scheduled (future) delivery, skip-cutlery, auto-apply coupons, a standing
   note to the restaurant, plus per-dish popular/healthy/health-warning badges.
   Saved and remembered, so you never answer twice.
3. **Lunch** (`/lunch`) — uses your remembered profile to pull and rank today's
   live 10Bis menu through the recommendation engine, and orders the dish you
   pick.

> **No required env vars, no database, no AI key.** Your profile and validated
> 10Bis session are remembered in your own browser (localStorage); the server
> is a stateless passthrough that ranks the menu and places orders. Set
> `TENBIS_CLIENT=mock` to demo with fake data; it defaults to `local` (real).

## Web app pieces

```
pages/index.tsx     landing page
pages/connect.tsx   F12 step-by-step + paste box (Step 1)
pages/profile.tsx   the remembered taste profile form (Step 2)
pages/lunch.tsx     ranked live options + one-tap ordering
pages/api/connect   parse paste -> validate -> return the session to the browser
pages/api/insights  read 10Bis history + budget + name/company + coupons -> /profile
pages/api/calendar  fetch an iCal feed -> meeting-free delivery slot for the window
pages/api/recommend rank the live menu against the saved profile
pages/api/order     place a real 10Bis order
lib/curlParse.ts    extract cookie + bearer from a cURL / header / cookie paste
lib/store.ts        browser-side memory (profile + session in localStorage)
domain/history.ts   derive recent/favourite/rarely + budget from order history
domain/calendar.ts  parse iCal + pick a delivery time with no meeting clash
services/menu.ts    gather live dishes + run the recommendation engine
```

The recommendation engine (`domain/`), the 10Bis client seam (`tenbis/`), and
crypto/config (`lib/`) are shared with — and reused from — the original bot.

---

## WhatsApp assistant

The WhatsApp assistant (Twilio + Supabase + Vercel Cron) is a first-class
surface again: it shares the same recommendation engine and 10Bis client as the
site, speaks Hebrew, and adds proactive daily prompts, autopilot with a cancel
window, weekly plans, and inline preference edits over chat.

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
