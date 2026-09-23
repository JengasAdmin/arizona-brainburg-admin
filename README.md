# ARIZONA RP — BRAINBURG (Server #5) — Administration Platform

Internal administration panel for **ARIZONA RP — BRAINBURG (Server #5)**: leadership terms,
deputies, factions, budgets, users, activity, notifications, audit logs and role/permission
governance — with Discord and VK sign-in, server-side RBAC and an immutable audit trail.

> Status: production-ready codebase. Game-server/bot integration layer is **architected but
> disabled** (see [Game integration](#game-integration)).

---

## Contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database: migrations & seed](#database-migrations--seed)
- [OAuth setup (Discord & VK)](#oauth-setup-discord--vk)
- [Architecture](#architecture)
- [RBAC model](#rbac-model)
- [Data integrity guarantees](#data-integrity-guarantees)
- [API surface](#api-surface)
- [Testing](#testing)
- [Deployment (Supabase + Vercel)](#deployment-supabase--vercel)
- [Known limitations](#known-limitations)
- [Game integration](#game-integration)

---

## Tech stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, Route Handlers, Server Components)        |
| UI         | React 19, TypeScript (strict), Tailwind CSS, Lucide icons         |
| Database   | PostgreSQL 15+ (Supabase or self-hosted), Drizzle ORM             |
| Auth       | Custom OAuth 2.0 — **Discord + VK only**, no passwords            |
| Sessions   | HS256 JWT in an `httpOnly` cookie (`jose`), 7-day expiry           |
| Tests      | Vitest                                                             |
| Deployment | Vercel (or any Node 20.9+ host)                                    |

## Quick start

```bash
# 1. Install dependencies (Node >= 20.9)
npm install

# 2. Configure the environment
copy .env.example .env.local      # Windows
# cp .env.example .env.local      # macOS/Linux
# ...fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET, OAuth credentials

# 3. Apply migrations, then seed the catalogs (roles, permissions, factions, settings)
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev                       # http://localhost:3000
```

Other scripts:

| Script                  | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `npm run build`         | Production build                          |
| `npm run start`         | Start the production server               |
| `npm run typecheck`     | `tsc --noEmit`                            |
| `npm run lint`          | ESLint                                    |
| `npm run test`          | Vitest (unit/integration, no DB required) |
| `npm run db:generate`   | Generate SQL from the Drizzle schema      |
| `npm run db:migrate`    | Apply pending `migrations/*.sql`          |
| `npm run db:migrate:status` | Show applied/pending migrations       |
| `npm run db:seed`       | Idempotent structural seed                |

> **Windows note:** if PowerShell blocks `npm.ps1`, use `npm.cmd …`.

## Environment variables

All secrets live in environment variables (`.env.local` locally, Vercel env vars in production).
Never commit real secrets. See `.env.example` for the annotated list.

| Variable                  | Required | Description                                                                 |
| ------------------------- | -------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`     | ✔        | Base URL, e.g. `https://admin.example.com`. Must match OAuth redirect URIs. |
| `AUTH_SECRET`             | ✔        | Signs session + OAuth state/CSRF cookies. Min 16 chars. `openssl rand -base64 48`. |
| `DATABASE_URL`            | ✔        | Pooled Postgres connection (app runtime).                                   |
| `DIRECT_URL`              | ✔        | Direct connection (migrations). Supabase: the non-pooler endpoint.          |
| `DISCORD_CLIENT_ID`       | ✔        | Discord application ID.                                                     |
| `DISCORD_CLIENT_SECRET`   | ✔        | Discord application secret.                                                 |
| `DISCORD_REDIRECT_URI`    | ✔        | `{APP_URL}/api/auth/discord/callback` — must match the Discord console exactly. |
| `VK_CLIENT_ID`            | ✔        | VK ID application ID (https://id.vk.com/).                                  |
| `VK_CLIENT_SECRET`        | ✔        | VK ID application secret.                                                   |
| `VK_REDIRECT_URI`         | ✔        | `{APP_URL}/api/auth/vk/callback` — must match the VK console exactly.       |
| `FUTURE_GAME_API_URL`     | –        | Game integration endpoint. Empty ⇒ integration shows “Not connected”.       |
| `FUTURE_GAME_API_KEY`     | –        | Game integration key. Empty ⇒ integration disabled.                         |
| `ALLOWLIST_DISCORD_IDS`   | –        | Comma-separated Discord IDs; empty ⇒ anyone with a valid OAuth login may sign up. |
| `ALLOWLIST_VK_IDS`        | –        | Same, for VK.                                                               |
| `RATE_LIMIT_REDIS_URL`    | –        | Shared rate-limit store on serverless. Empty ⇒ in-memory (see limitations). |

There is **no password login** — Discord and VK are the only identity providers.

## Database: migrations & seed

```bash
npm run db:migrate           # applies migrations/*.sql in filename order, transactional
npm run db:migrate:status    # [applied]/[pending] per file
npm run db:seed              # idempotent: permissions, 39 roles, role grants,
                             # 8 departments, 14 factions + positions, settings
```

- The migration runner is a small dependency-free script (`scripts/migrate.ts`). It creates a
  `schema_migrations` table and applies each file once, in filename order, inside a transaction.
- Files are applied as: `0000_init.sql` → `0001_integrity.sql` → `0001_user_preferences.sql`.
  Both `0001_*` files are independent (one adds triggers/checks, the other a table + column),
  so the alphabetical order between them is safe. `migrations/meta/_journal.json` tracks only
  the drizzle-generated files; the hand-written `0001_integrity.sql` is applied by the same
  runner but is not part of drizzle's snapshot journal.
- After changing `src/db/schema`, run `npm run db:generate` to append a new SQL file, then
  `npm run db:migrate`.
- `npm run db:seed:demo` / `scripts/demo.ts` creates **demo data only outside production** and
  refuses to run when `NODE_ENV=production`.

## OAuth setup (Discord & VK)

**Discord** — https://discord.com/developers/applications → New Application → OAuth2:

- Copy Client ID / Client Secret into the env vars.
- Add redirect: `http://localhost:3000/api/auth/discord/callback` (dev) and the production
  equivalent. It must match `DISCORD_REDIRECT_URI` exactly.

**VK (VK ID)** — https://id.vk.com/ → Create project → Standard web project:

- Copy `vk_app_id` (Client ID) and secure key (Client Secret).
- Add callback: `http://localhost:3000/api/auth/vk/callback` (and production).

Flow: `GET /api/auth/{discord|vk}` → provider → `/api/auth/{provider}/callback` → issue session
cookie. The OAuth `state` parameter is stored in a signed cookie (CSRF protection); Discord
additionally uses PKCE. Optional `mode=link` connects a second provider to the signed-in account.

## Architecture

```
src/
├── app/
│   ├── api/                    # Route Handlers — every endpoint goes through guard()
│   │   ├── auth/               # OAuth start/callback, logout, logout-all, session
│   │   ├── me/                 # own profile + preferences
│   │   ├── dashboard/ users/ leaders/ deputies/ factions/ budgets/
│   │   ├── activity/ notifications/ audit/ search/ settings/ count/
│   │   └── admin/roles/        # role & permission governance
│   │       └── integration/    # status, keys, game/* (prepared, disabled)
│   ├── (app)/                  # authenticated pages (server components)
│   └── 403/404/500, landing    # error & sign-in pages
├── components/
│   ├── ui/                     # design system primitives (buttons, dialogs, tables…)
│   └── users/ leadership/ factions/ budgets/ activity/
│       notifications/ audit/ settings/ admin/
├── lib/
│   ├── rbac/                   # permissions.ts, roles.ts, engine.ts (pure, tested)
│   ├── catalog/                # faction catalog
│   └── settings-catalog.ts     # system settings definitions
├── server/
│   ├── guard.ts                # the one API pipeline (see below)
│   ├── http.ts                 # ApiError, validation, error envelope
│   ├── page-auth.ts            # requirePageAuth() for server pages
│   ├── auth/                   # session JWT, access loader
│   ├── oauth/                  # Discord + VK providers/flow
│   ├── security/rate-limit.ts  # sliding-window limiter
│   └── services/               # business logic (users, leadership, factions,
│                               # budget, activity, audit, notifications, …)
└── db/                         # Drizzle schema (23 tables)
migrations/                     # SQL migrations (runner: scripts/migrate.ts)
scripts/                        # migrate.ts, seed.ts, demo.ts
tests/                          # Vitest suites
```

**Request pipeline.** Every API route is wrapped by `guard()`:

```
rate limit → HTTP method → authentication → body validation
          → scope resolution (department) → permission check → handler
```

Failures return a uniform envelope with the right status:

```jsonc
{ "error": { "code": "MISSING_PERMISSION", "message": "Missing permission: MANAGE_ROLES.", "details": null } }
```

`401` unauthenticated · `403` forbidden/blocked/wrong method · `404` not found ·
`409` conflict (state rules) · `422` validation (with `details[]`) · `429` rate-limited
(+ `Retry-After`) · `500` generic — internal messages never leak to the client.

**UI pattern.** Server pages call `requirePageAuth(PERM)` and services directly (data never
reaches the client twice); client components call `api()` and `router.refresh()`. UI hiding is
cosmetic — the server re-checks every action.

**Design language.** Minimal black enterprise: `#050505 / #0A0A0A / #111111 / #171717 / #202020`,
English UI, immutable `#N` internal user IDs, Server ID fixed to **5**.

## RBAC model

The catalog lives in `src/lib/rbac/`:

- `permissions.ts` — **36 permissions** (grouped: Dashboard, Users, Leadership, Deputies,
  Factions, Budget, Activity, Logs, Notifications, Administration, System, Integration).
  `critical: true` marks permissions only the top tier may hold or grant.
- `roles.ts` — **39 roles**:
  - Site Founder / Developer (level 100, full access)
  - Chief Administrator (90) · Deputy Chief Administrator (85) · Curator (80)
  - **8 directions × 4 supervisor tiers** = 32 scoped roles
    (Chief 70 / Deputy Chief 66 / Senior 62 / Supervisor 58)
  - Administrator Level 4 (45, read-mostly + moderation, no appoint/budget)
  - Administrator Level 3 (40, junior/read-mostly)
  - Player (0, view-only defaults)
- `engine.ts` — pure decision functions (`can`, `canAssignRole`, `canGrantPermission`,
  `canManageAdminUsers`), fully unit-tested.

Rules enforced **on the server** (see `tests/rbac-engine.test.ts`, `tests/guard.test.ts`):

1. Non-active accounts (suspended/blocked/inactive) can do nothing.
2. A role with `departmentId = X` grants permissions only **inside** department X; scoped roles
   are denied on global operations. `departmentId = null` ⇒ global.
3. Nobody may assign a role **above their own level** — Founder exempt (level 100).
4. Only the critical four (**Founder / Chief / Deputy Chief / Curator**) may touch roles in the
   `administration` category or hold `MANAGE_ROLES` / `MANAGE_ADMINS`.
   Curator deliberately lacks `MANAGE_PERMISSIONS` and `SYSTEM_SETTINGS`.
5. You can never grant a permission you do not hold yourself (Founder exempt).
6. Every privileged action writes an audit entry.

Directions map to factions: State Structures (Gov, LSPD, SFPD, LSSD, LVPD, FBI), Central
Management (LSTV, Licensing), Healthcare (LSMC, AMH, Fire Dept), Maximum Security Prison
(LVMSP), Ministry of Defense (LSA, SFA); Ministry of Justice / Ghetto / Mafia are reserved
extensible directions.

## Data integrity guarantees

Enforced in **PostgreSQL** (`migrations/0001_integrity.sql`) so they hold even if application
code is bypassed:

- **Append-only tables** — `audit_logs`, `budget_transactions`, `leadership_points_history`,
  `disciplinary_actions` reject `UPDATE`/`DELETE` via row triggers.
- **Ledger math** — `CHECK (balance_after = balance_before + amount)`; deposits must be
  positive, withdrawals negative (`type_matches_amount`).
- **Budget balance floor** — hard `CHECK`; the `allow_negative_budget` setting governs the
  service-layer rule (409 `INSUFFICIENT_BALANCE` otherwise).
- **Term lifecycle** — active terms have `dismissed_at IS NULL`, dismissed terms must carry it;
  term status domain is `active|dismissed`.
- **Status domains** — `users.status ∈ (active, suspended, blocked, inactive)`,
  `disciplinary_actions.type ∈ (warning, reprimand)`, `oauth_accounts.provider ∈ (discord, vk)`.
- **`updated_at` maintenance** triggers on mutable tables.

**Balance is derived from the ledger**: `createBudgetTransaction` locks the account row,
verifies funds, inserts the ledger entry and updates the balance in one transaction — the
balance can never change without a corresponding transaction.

### Architectural decisions (intentional, not oversights)

- **Deputies are leadership terms.** Deputies reuse the `leadership_terms` table with a
  position of `kind = 'deputy'` instead of a separate table — one lifecycle, one history, one
  set of integrity constraints for leaders and deputies alike.
- **Warnings and reprimands share one table.** `disciplinary_actions.type ∈ (warning,
  reprimand)` rather than two nearly-identical tables; counts, reasons and history stay
  consistent and queries stay simple.
- **Custom OAuth instead of NextAuth.** Only two providers are supported, so the flow is a
  small, auditable implementation: signed state cookie, PKCE for Discord, VK ID (id.vk.com),
  and a JWT session with `tokenVersion` revocation (`logout-all` bumps the version).
- **Scope in the engine, filters in SQL.** `can()` decides whether an actor may perform an
  operation in a department; `actorScope()` produces the `department_id = ANY(…)` row filter
  for list queries. Both are tested.

## API surface

All endpoints are JSON and go through `guard()`. Summary:

```
GET/POST  /api/auth/{discord|vk}[?mode=link]   /api/auth/{discord|vk}/callback
POST      /api/auth/logout · /api/auth/logout-all · GET /api/auth/session
GET/PATCH /api/me · GET/PATCH /api/me/preferences
GET       /api/dashboard · /api/search · /api/count
GET       /api/users · GET/PATCH /api/users/:id
POST      /api/users/:id/status · /api/users/:id/game-id · /api/users/:id/profile
GET/POST  /api/users/:id/roles · DELETE /api/users/:id/roles/:roleKey
GET/POST  /api/leaders · GET /api/leaders/:termId/history
POST      /api/leaders/:termId/{dismiss,points,disciplinary}
GET       /api/deputies
GET/PATCH /api/factions · /api/factions/:id · POST /api/factions/:id/positions
GET/POST  /api/budgets · /api/budgets/:factionId/transactions
GET/POST  /api/activity
GET       /api/notifications · POST /api/notifications (mark all read)
POST      /api/notifications/:id/read
GET       /api/audit
GET/POST  /api/admin/roles · PUT /api/admin/roles/:roleKey/permissions
GET/PATCH /api/settings/:key
GET       /api/integration · GET/POST /api/integration/keys · DELETE /api/integration/keys/:id
POST      /api/integration/game/events · GET /api/integration/game/players   (disabled)
```

Write routes require a valid session, pass rate limiting and a server-side permission check;
mutations also record an `audit_logs` entry.

## Testing

```bash
npm run test          # vitest run
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
```

105 tests across 7 suites — **no database required** (services are mocked at the `db` boundary):

| Suite                     | Covers                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `rbac-engine`             | 403 decisions, hierarchy (no assigning above own level), Founder exemption, Curator limits, Admin L3/L4 restrictions, specialized-supervisor scope (in/out/global), grant-only-what-you-hold |
| `rbac-catalog`            | 36 permissions / 39 roles, uniqueness, tier ordering & permission superset, critical-four exclusivity |
| `guard`                   | method/auth/blocked/rate-limit/validation codes, in- vs out-of-scope 403s, 500 never leaks internals |
| `budget`                  | deposit/withdrawal ledger math, insufficient-balance 409 with nothing written, balance = Σ ledger, before/after chaining, audit entries, 404 |
| `leadership-schema`       | appointment/dismissal/points/disciplinary validation, strict calendar dates, query defaults |
| `session`                 | JWT round-trip, forged/tampered/expired/wrong-alg rejection, secret handling |
| `utils`                   | date/money/id formatting, audit sentences, rate limiter windows      |

## Deployment (Supabase + Vercel)

**Supabase**

1. New project → copy the connection strings: **Transaction** pooler ⇒ `DATABASE_URL`,
   **Session**/direct ⇒ `DIRECT_URL` (migrations need the direct one).
2. `npm run db:migrate && npm run db:seed` from a machine that can reach the database
   (or run `migrations/*.sql` + `scripts/seed.ts` through your CI).

**Vercel**

1. Import the repo — Framework preset: Next.js (no custom build settings).
2. Add every variable from [Environment variables](#environment-variables) for
   *Production* (and *Preview* with the preview URL as `NEXT_PUBLIC_APP_URL`).
3. Update the Discord/VK redirect URIs to the production callback URLs **before** first login.
4. Deploy.

The app reads `AUTH_SECRET`, database and OAuth secrets at runtime — nothing is baked into the
client bundle. Security headers (CSP, frame-denying, nosniff, referrer policy) are set in
`next.config.ts`.

## Known limitations

- **Rate limiter is in-memory.** Each serverless instance keeps its own window, so the limit is
  per-instance on Vercel. Set `RATE_LIMIT_REDIS_URL` / swap `src/server/security/rate-limit.ts`
  for a shared store (e.g. Upstash Redis) when you need a global limit. On a single Node host
  the limiter is exact.
- **Demo mode never runs in production** (`scripts/demo.ts` refuses when `NODE_ENV=production`).
- **First user bootstrap:** there is no password reset path (there are no passwords). If you
  lose access to the Founder account's Discord/VK, promote a user directly in the database:
  `UPDATE users SET …` / insert into `user_roles` for `site_founder`.
- **`npm audit` advisories are dev/build-time only.** The remaining findings live in tooling
  (`vitest`, `esbuild` via `drizzle-kit`, `postcss` bundled inside `next`) — none ship in the
  production runtime bundle. Runtime dependencies are patched (e.g. `drizzle-orm >= 0.45.3`,
  which fixes GHSA-gpj5-g38j-94v9). Re-check with `npm audit` when upgrading `next`.

## Game integration

The bot/game-server API is **prepared but disabled**:

- `POST /api/integration/game/events` and `GET /api/integration/game/players` exist and are
  authenticated by integration API keys (`game:read`, `activity:write` scopes).
- With `FUTURE_GAME_API_URL` / `FUTURE_GAME_API_KEY` empty, the Settings → Integration panel
  shows **Not connected** and no traffic is accepted beyond key validation.
- Enabling it is purely a configuration step — no code changes required.

## License

MIT — see [LICENSE](./LICENSE).
