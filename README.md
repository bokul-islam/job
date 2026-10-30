# TalentBridge — Full-Stack Job Marketplace

A production-grade, two-sided job marketplace connecting **employers** and **job seekers**: job posting & search, applications with status workflow, secure messaging with response-time analytics, membership plans with signed-webhook payments, video CVs on private storage, in-app + email notifications, and a full admin console.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Forms | React Hook Form + Zod (server-side validation is authoritative) |
| Database | PostgreSQL via Drizzle ORM (Supabase-compatible — see `supabase/policies.sql` for RLS) |
| Auth | scrypt-hashed passwords, HTTP-only cookie sessions, email verification & password reset tokens |
| Files | Cloudflare R2 presigned uploads (S3-compatible) with a secure local-disk dev driver |
| Email | Provider-independent interface — Resend free tier when `RESEND_API_KEY` is set, otherwise logged to the admin mail outbox |
| Payments | Provider abstraction: signed **sandbox** webhooks now; SSLCommerz & bKash activate with merchant credentials |
| Charts | Recharts |

## Quick start (local)

```bash
cp .env.example .env          # fill DATABASE_URL at minimum
npm install
npx drizzle-kit push          # create all tables
npx tsx src/db/seed.ts        # demo data (dev only, clearly labelled)
npm run dev
```

### Demo accounts (password for all: `Password123`)

| Role | Email |
|---|---|
| Super admin | superadmin@talentbridge.dev |
| Admin | admin@talentbridge.dev |
| Employer (Premium) | farhana@airtech.dev |
| Employer (Free) | tanvir@finplus.dev |
| Job seeker (Standard) | nabila.dev@example.com |
| Job seeker (Free) | rakib.ui@example.com / sadia.data@example.com |

> **Development email:** without `RESEND_API_KEY`, verification/reset links are written to the server console and to **Admin → Mail outbox** — click from there.

## Feature map

- **Auth**: register (role-aware), login/logout, email verification (required before applying/posting/messaging), password reset, rate limiting, suspended-account handling.
- **Job seekers**: profiles (education, experience, skills), PDF resume manager, video CV (entitlement-gated, private streaming), job search with DB-side filters + pagination, save jobs, apply with resume + cover letter, duplicate-application prevention, status timeline, response-time stats.
- **Employers**: company profile w/ verification, job CRUD (draft → publish → pause → close), plan-limited active posts, applicant pipeline (viewed → shortlisted → interview → hired/rejected, with audit history + notifications), plan-gated candidate search, candidate response stats, message candidates.
- **Messaging**: conversations, unread counts, read markers, attachments (participant-checked), block/report, live updates via polling (swap in Supabase Realtime channels in production). Email notifications contain a secure link back — **inbound email replies are intentionally not faked**; the webhook contract is documented in `src/lib/relay.ts`.
- **Response-time analytics**: obligation-based tracking (consecutive messages count once, unanswered tracked separately, automated messages excluded), average/median/rate/fastest/slowest + optional Mon–Fri 09:00–18:00 business-hours metric.
- **Membership**: admin-editable plans + entitlements enforced server-side (applications/month, active posts, messages/day, searches/day, video CV, featured). Monthly/yearly subscriptions, renewal cancel/resume, automatic expiry, payment + subscription history.
- **Payments**: webhooks recorded idempotently (`payment_webhook_events`), HMAC signature verification before any activation, sandbox simulator exercises the real pipeline — **no fake payment success**.
- **Admin**: dashboards with real DB metrics, user suspend/reactivate + role management (super admin), job flag/force-close, report queue, plan editor (super admin), audit + webhook logs, mail outbox, platform settings (video limits, signups), dev membership grant (clearly labelled, logged).
- **Security**: server-side role checks everywhere, Zod input validation, HMAC upload tokens, magic-byte file validation (not extension-based), path-traversal-guarded file serving, download permission checks, timing-safe signature comparisons, safe error messages.

## Database schema

34 tables covering auth, profiles, companies, jobs, applications, messaging, notifications, membership/payments, response metrics, moderation, and audit. Key constraints: unique `(job_id, seeker_id)` on applications, unique `(provider, event_id)` webhook dedupe, cascades on ownership delete, indexes on hot query paths. Apply with `npx drizzle-kit push`; Supabase RLS reference policies live in `supabase/policies.sql`.

## Deployment (free tiers)

1. **GitHub**: push this repo. Keep `.env` out of source control.
2. **Supabase** (free: 500 MB database, 2 GB bandwidth): create project → copy pooled connection string into `DATABASE_URL` → run `npx drizzle-kit push` → optionally enable `supabase/policies.sql`.
3. **Cloudflare R2** (free: 10 GB): create bucket → API token (R2 read/write) → set `R2_*` vars. Client uploads then go browser→R2 directly with 5-minute presigned PUT URLs.
4. **Cloudflare Workers + OpenNext**: `npm i --save-dev @opennextjs/cloudflare` → `npx opennextjs-cloudflare build && npx wrangler deploy`. Set secrets with `wrangler secret put`.
   - Note: the local dev storage driver writes to disk, which Workers cannot do — configure R2 before deploying, or gate uploads.
   - `pg` connections need the Hyperdrive binding or Supabase's pgbouncer URL.
5. **Resend**: add `RESEND_API_KEY` + verify your sending domain.

Vercel may be used for hobby/demo deployments; per Vercel's terms the free Hobby plan does not cover commercial production use.

### Free-tier limits to respect

| Service | Free limit |
|---|---|
| Supabase | 500 MB DB, paused after 7 days inactivity, 2 GB bandwidth |
| Cloudflare R2 | 10 GB storage, 1M writes, 10M reads / month |
| Resend | 3,000 emails/month, 100/day |
| SSLCommerz/bKash | Sandbox free; production requires merchant onboarding |

## Testing

```bash
npx vitest run        # unit tests: response metrics, business hours, crypto, webhooks, validators
npm run typecheck     # strict TypeScript
npm run build         # production build
```

Key behaviors covered by tests: response-time computation rules (unanswered ≠ zero-time, median/mean), business-hours windows, scrypt round-trips, timing-safe webhook signatures, and Zod validation boundaries (duplicate-prevention and role rules are additionally enforced by DB constraints + server actions).

Integration testing suggestions (real DB): register → verify via outbox link → post job → apply → message → observe metrics; sandbox checkout → plan entitlement change → webhook event row.

## Project structure

```
src/
  db/            schema.ts (34 tables) · index.ts · seed.ts
  lib/           auth · passwords · email · notifications · entitlements
                 metrics (pure) · payments(-core) · storage · queries ·
                 rate-limit · validators · logging · relay
  lib/actions/   server actions: auth, profile, jobs, applications,
                 messaging, membership, uploads, admin
  app/           public pages · auth · dashboards (seeker/employer/admin) ·
                 api routes (uploads, files, messages, notifications, webhooks)
  components/    ui primitives · chrome · forms · inbox · pricing · video-cv · charts
tests/           vitest unit tests
supabase/        policies.sql (RLS reference)
```

## Honest limitations (not faked)

- Live updates use 3–10s polling; plug Supabase Realtime into `/api/messages` for true push.
- Video duration is validated against a client-reported value and a server-side cap; ffprobe-based verification belongs behind a processing service.
- R2 has no transcoding/adaptive streaming; playback uses browser-native progressive download by design (upgrade path documented in `src/lib/storage.ts`).
- Inbound email reply relay is a documented contract, not an active feature, until an inbound provider is configured.
- SSLCommerz/bKash activate only with real merchant credentials.
