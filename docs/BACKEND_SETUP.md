# Backend Setup — Accounts, Cloud Sync & the Supporter Plan

IB EconGraph AI runs **fully free and local by default**: no accounts, no server,
data in `localStorage`, AI via the user's own API key. This guide configures the
optional cloud backend that powers the **Supporter** plan:

| Feature | Needs |
|---|---|
| Sign-in (email + password / Google) | Supabase |
| Cloud sync + version history | Supabase |
| Shareable view-only links | Supabase |
| Custom template library | Supabase |
| Hosted AI (no BYOK key) | Supabase + a server AI key (Vertex AI or Google AI Studio) |
| Subscriptions / billing | Polar |

If any environment variable is missing, the related feature quietly disappears
from the UI — a fork with zero configuration still works perfectly.

---

## 1. Supabase (auth + database)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the **SQL Editor**, paste and run the entire contents of
   [`supabase/schema.sql`](../supabase/schema.sql). It is idempotent — safe to
   re-run after updates.
3. **Auth → Providers → Email**: keep it enabled and turn **"Confirm email" ON**.
   The app uses **email + password** with one-time email verification (not magic
   links, which would send an email on every login). Optionally enable **Google**
   and add your OAuth client ID/secret — Google sign-in sends **no** emails, so
   it's the cheapest option for users. Also turn on **leaked-password protection**
   (Auth → Providers/Policies → "Prevent use of compromised passwords" /
   HaveIBeenPwned) — this clears the `auth_leaked_password_protection` linter warning.
4. **Auth → URL Configuration**:
   - **Site URL** → your deployment (e.g. `https://ib-econgraph-ai.vercel.app`).
   - **Redirect URLs** → add every origin you sign in from, so confirmation,
     password-reset and Google OAuth links return to the right page. Use a
     path wildcard (`https://your-domain/**`): sign-in returns to `/settings`
     normally, but to `/pricing` when it was triggered from the checkout gate,
     so a `/settings`-only entry is not enough. Include your prod domain plus,
     for local testing, `http://localhost:4000/**` and your dev-tunnel
     `https://<id>.devtunnels.ms/**`. If an origin isn't listed, Supabase falls
     back to the Site URL and the link won't land where it should.
5. **Auth > Emails / SMTP.** Supabase's built-in mailer is capped at **2 emails
   per hour** and is explicitly **not for production**. Verification and
   password-reset emails go to real users, so you need a sender their inboxes will
   accept. Options for a free setup with **no custom domain**:
   - **Gmail SMTP (recommended free, no-domain option).** Send through your own
     Gmail account. Turn on 2-Step Verification for the Google account, generate an
     **App Password** (Google Account, Security, App passwords), then in Supabase
     set custom SMTP to host `smtp.gmail.com`, port `465` (SSL) or `587` (TLS),
     username = your Gmail address, password = the App Password, sender = the same
     Gmail address. Because the mail actually leaves Google's servers, SPF/DKIM
     line up and it reaches inboxes rather than spam. Gmail allows roughly **500
     recipients/day**, far more than auth emails need. Good for a small app; move
     to a domain-based sender if you ever outgrow it.
   - **Lean on Google sign-in** (zero emails) as the primary path, with
     email+password as the fallback. This keeps email volume tiny whatever SMTP
     you use.
   - **A note on Resend / Brevo / Mailjet.** These are good services, but to send
     to *other people* they need a **verified domain** (you add DNS records). Their
     free shared senders (for example `onboarding@resend.dev`) can only email your
     own account, so without a domain they're testing-only. Once you have a cheap
     domain, Resend's free tier (100/day, 3k/month) is the clean upgrade from Gmail
     SMTP, and it raises Supabase's initial send limit to 30/hour (adjustable).

   Custom SMTP is a Supabase setting, not a Vercel/hosting one, so it doesn't
   conflict with staying on Vercel's free plan.
6. Collect the keys from **Project Settings → API Keys**:
   - Project URL → `VITE_SUPABASE_URL` *and* `SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `VITE_SUPABASE_PUBLISHABLE_KEY`.
     This is the modern replacement for the legacy `anon` key — low-privilege and
     safe to ship in the client bundle.
   - **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (server-side only,
     never expose). This replaces the legacy `service_role` key; it bypasses RLS
     and Supabase rejects it outright if it's ever sent from a browser.

### Security model (already encoded in schema.sql)

- All tables have row-level security. Users can only read their own rows.
  The `shares` table is **not** publicly readable — anonymous SELECT is revoked
  and view-only links resolve through the `get_share(id)` security-definer RPC,
  which returns just the diagram payload (never the owner id or other shares),
  so the 96-bit slugs can't be bulk-enumerated.
- **Writes** to synced data require an active Supporter entitlement
  (`is_pro()`); **reads are never gated**, so lapsed subscribers can always
  retrieve their data.
- Billing columns on `profiles` are writable only via the secret key
  (column-level grants); users can edit only display/supporter-name fields.
- AI usage metering uses atomic SQL functions callable only with the secret key.

## 2. Hosted AI

The server generates diagrams for supporters using **one** of three backends.
They are tried in this order and the first one configured wins, so set the
variables for exactly one. All are set on the server (Vercel > Project >
Settings > Environment Variables).

**Option A — Vertex AI express mode.** Vertex AI was renamed *Gemini Enterprise
Agent Platform* in 2026, but the API is the same. Express mode gives you a single
API key with no service account, so it just works on serverless. Create the key
in the Google Cloud console (express mode), then set:

```dotenv
VERTEX_API_KEY=...            # Vertex express-mode API key
HOSTED_AI_MONTHLY_LIMIT=150
HOSTED_AI_MODEL=gemini-2.5-flash
```

> Personal-account caveat: creating a Vertex API key requires a Google Cloud
> **organization**. The Google-managed constraint
> `iam.managed.disableServiceAccountApiKeyCreation` is enforced by default and
> can only be lifted at the org level, so a plain personal (@gmail.com) account
> with no organization cannot create one. If that's you, use Option B (a
> service-account key, which is *not* blocked on a no-org project) or Option C.

**Option B — Vertex AI with a project (works on a personal, no-org account).**
Use a GCP project id (plus an optional location, default `global`). Locally the
server authenticates with your gcloud Application Default Credentials, so run
`gcloud auth application-default login` once. Vercel has no gcloud, so there you
must also create a service account with the *Vertex AI User* role and paste its
key JSON, as a single line, into `GOOGLE_SERVICE_ACCOUNT_JSON`:

```dotenv
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}   # Vercel only
HOSTED_AI_MONTHLY_LIMIT=150
HOSTED_AI_MODEL=gemini-2.5-flash
```

**Option C — Gemini Developer API (Google AI Studio).** The simplest fully-free
option. Get a key at <https://aistudio.google.com/apikey>:

```dotenv
GEMINI_API_KEY=...            # Google AI Studio key
HOSTED_AI_MONTHLY_LIMIT=150
HOSTED_AI_MODEL=gemini-2.5-flash
```

Cost check: Gemini Flash costs well under $0.01 per diagram generation, so 150
generations cost far less than the $5/month plan price. Vertex (A/B) bills
through Google Cloud; AI Studio (C) has a free tier.

> **Privacy consequence of this choice.** The three backends are not equivalent
> for user data. Google's paid Cloud/Vertex endpoints (A and B) are covered by
> terms that exclude training on customer content; the free Gemini developer
> tier (C) permits Google to review content and use it to improve its services.
> The privacy policy in `components/LegalPages.tsx` describes both cases, so it
> stays accurate whichever you pick, but if you run a public deployment on
> Option C your users' prompts are handled under the free-tier terms. Prefer A
> or B for anything beyond personal or testing use.

## 3. Polar (billing)

1. Create an organization at [polar.sh](https://polar.sh)
   (use [sandbox.polar.sh](https://sandbox.polar.sh) for testing with
   `POLAR_SERVER=sandbox`).
2. Create **two products**, both "Software subscription":
   - *EconGraph Supporter (Monthly)* — $5 / month
   - *EconGraph Supporter (Yearly)* — $50 / year
   Copy each product ID into `POLAR_PRODUCT_ID_MONTHLY` / `POLAR_PRODUCT_ID_YEARLY`.
3. Create an **access token** (Settings → Developers) with `checkouts:write`,
   `customer_sessions:write`, `customers:read`, and `subscriptions:write` scopes
   → `POLAR_ACCESS_TOKEN`. (`subscriptions:write` lets the account-deletion
   endpoint cancel a user's subscription so a deleted account isn't billed.)
4. Add a **webhook** (Settings → Webhooks):
   - URL: `https://<your-domain>/api/webhooks/polar`
   - Format: RAW
   - Events: all `subscription.*` events (created, active, updated, canceled,
     uncanceled, revoked, past_due)
   - Copy the signing secret → `POLAR_WEBHOOK_SECRET`
5. Polar acts as **merchant of record**, so EU VAT is handled for you.

The webhook keeps `profiles.pro_status` / `pro_until` in sync. Entitlement =
`pro_until > now()`; the server grants a 1-day grace period past each billing
period end so renewals never cause flapping. (`ACTIVE_MARGIN_DAYS` in
`api/webhooks/polar.ts`.)

## 4. Vercel environment variables — summary

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | build (client) | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build (client) | Supabase publishable key (`sb_publishable_…`) |
| `SUPABASE_URL` | server | same URL, for API routes |
| `SUPABASE_SECRET_KEY` | server | Supabase secret key (`sb_secret_…`) — never expose |
| `VERTEX_API_KEY` | server | hosted AI via Vertex express mode (option A) |
| `GOOGLE_CLOUD_PROJECT` | server | hosted AI via Vertex project (option B) |
| `GOOGLE_CLOUD_LOCATION` | server | Vertex location, default `global` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | server | Vertex service-account key JSON (option B on Vercel) |
| `GEMINI_API_KEY` | server | hosted AI via Google AI Studio (option C) |
| `HOSTED_AI_MONTHLY_LIMIT` | server | default 150 |
| `HOSTED_AI_MODEL` | server | default `gemini-2.5-flash` |
| `POLAR_ACCESS_TOKEN` | server | Polar API |
| `POLAR_WEBHOOK_SECRET` | server | webhook signature verification |
| `POLAR_PRODUCT_ID_MONTHLY` | server | monthly product |
| `POLAR_PRODUCT_ID_YEARLY` | server | yearly product |
| `POLAR_SERVER` | server | `production` or `sandbox` |
| `APP_URL` | server | canonical site URL for checkout redirects |
| `ALLOWED_ORIGINS` | server | *optional*, comma-separated extra origins allowed as checkout redirect targets |

Checkout success/cancel URLs are handed to Polar, which redirects the browser
there after payment, so they are never taken straight from the request's
`Origin`/`Host` header. An origin is accepted only if it matches `APP_URL` or an
entry in `ALLOWED_ORIGINS`; outside production (`NODE_ENV !== 'production'`),
localhost and the dev-tunnel providers listed in `api/_lib/polar.ts` are also
accepted. Anything else falls back to `APP_URL`. A self-hosted production
deployment serving more than one domain must list the extras in
`ALLOWED_ORIGINS`.

## 5. Testing the full flow

> **Local dev serves the API for you.** `npm run dev` (Vite) mounts the `api/*`
> functions in-process via a dev-only plugin (see `vite.config.ts`), so
> `/api/checkout`, `/api/usage`, etc. work on `http://localhost:4000` with no
> Vercel CLI needed — it reads your local `.env` for the server-side vars. For
> local checkout redirects, set `APP_URL=http://localhost:4000`.
> (`npm run dev:api` = `npx vercel dev` is an alternative that runs the real
> Vercel runtime. The CLI is deliberately *not* in `devDependencies` — it is a
> large install that most contributors never need — so `npx` fetches it on
> first use. It also needs `vercel login`/`link` and is finicky on
> Windows + Node 24.)
>
> **Webhook reachability:** the entitlement flip to Supporter is driven by the
> Polar `subscription.*` webhook, and Polar (even in sandbox) can only reach a
> **public** URL — not `localhost`. So the checkout will open and complete
> locally, but the profile won't turn Pro until the webhook hits a reachable
> `/api/webhooks/polar`. For a true end-to-end test, either deploy a Vercel
> preview and point the Polar sandbox webhook at it, or expose your local
> server with a tunnel (ngrok/cloudflared) and use that URL in Polar.

1. Deploy (or run `npm run dev:api`) with sandbox Polar + a real Supabase project.
2. Create an account with email + password (or Google) in Settings → Account &
   Cloud. With "Confirm email" on you'll get a verification link that returns to
   `/settings`; locally, either use Google or confirm the user in Supabase →
   Auth → Users.
3. Pricing page → Become a Supporter → complete the sandbox checkout
   (test card `4242 4242 4242 4242`).
4. You are redirected to `/settings?checkout=success`; within a few seconds the
   webhook flips the profile to Supporter and the UI updates.
5. Verify: cloud sync status turns active, hosted AI provider works, a share
   link opens in an incognito window, and canceling in the billing portal
   downgrades after the period ends.

## 6. Updating the README supporters list

Fetches Supporters who opted in (Settings → "Show me in the README") and
rewrites the block between the `SUPPORTERS:START/END` markers in `README.md`.

**Automated (recommended):** the workflow `.github/workflows/update-supporters.yml`
runs it **every Monday** (and on-demand from the Actions tab) and commits any
change. Add two repository secrets under **Settings → Secrets and variables →
Actions**: `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Nothing else to run.

**Manually**, if you prefer:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/update-supporters.mjs
```

Note it lists only *current* Supporters (subscription still active) and always
reflects each person's latest chosen name, so name changes are picked up on the
next run.

## 7. Account deletion (GDPR)

Users can permanently delete their account and all cloud data from **Settings →
Account & Cloud → Delete account** (backed by `/api/delete-account`). It cancels
any active Polar subscription first (needs the `subscriptions:write` token scope),
then deletes the auth user — which cascades to every table via `on delete
cascade`. Local, unsynced diagrams on the user's device are untouched.

## 8. Free-tier fit (Supabase)

Everything here fits Supabase's free plan for a small project: 500 MB database,
1 GB storage, 5 GB egress/month, 50,000 monthly active users, unlimited API
requests. The main watch-outs: the **2 emails/hour** auth mailer (see §1.5), and
free projects **pause after 7 days of inactivity**. Vercel's Hobby plan hosts
the app + API functions for free.

To keep a low-traffic project from pausing, this repo ships a GitHub Actions
workflow, `.github/workflows/db-keepalive.yml`, that runs every ~5 days and does
one cheap read against the database. It reuses the same `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` repository secrets as the supporters workflow (Settings >
Secrets and variables > Actions), and you can also trigger it manually from the
Actions tab. If those secrets are absent it exits cleanly without failing.
