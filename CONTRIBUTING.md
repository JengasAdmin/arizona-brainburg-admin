# Contributing

Thanks for improving the ARIZONA RP — BRAINBURG administration platform.

## Ground rules

- **English-only UI copy.** The product language is English.
- **Server-side checks are the source of truth.** Hiding a button is never a security measure:
  every protected action must go through `guard()` (API) or `requirePageAuth()` (pages) and the
  RBAC engine in `src/lib/rbac/engine.ts`.
- **No secrets in code.** Everything configurable goes through environment variables
  (`.env.example` is the contract).
- **Immutable means immutable.** `audit_logs`, `budget_transactions`, `leadership_points_history`
  and `disciplinary_actions` are append-only, enforced by database triggers. Never add code that
  updates or deletes rows in these tables.

## Development workflow

```bash
npm install
copy .env.example .env.local     # fill in values
npm run db:migrate
npm run db:seed
npm run dev
```

Before opening a pull request, all of these must pass:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

PowerShell users: invoke npm as `npm.cmd …` if execution policy blocks the `.ps1` shims.

## Making changes

### Schema changes

1. Edit `src/db/schema`.
2. `npm run db:generate` — appends a new SQL file under `migrations/`.
3. Add any ORM-expressible integrity rules (triggers, CHECKs) by hand if needed.
4. `npm run db:migrate` locally and verify `npm run db:migrate:status`.

### RBAC changes

- Add permissions to `PERMISSION_KEYS` + `PERMISSIONS` in `src/lib/rbac/permissions.ts`
  (mark `critical` for top-tier-only permissions).
- Roles live in `src/lib/rbac/roles.ts`. Keep the invariants covered by
  `tests/rbac-catalog.test.ts` (unique keys/names, tier ordering, critical-four exclusivity) or
  update those tests deliberately.
- Extend `tests/rbac-engine.test.ts` with the new rule — hierarchy and scope decisions are
  regression-tested, not assumed.

### API routes

Wrap every handler in `guard()`; never hand-roll auth/permission checks:

```ts
export const POST = guard(
  { method: "POST", permission: "MANAGE_BUDGET", schema: mySchema, scope: resolveScope },
  async ({ auth, body, params }) => {
    // business logic in a service, audit entry via writeAudit()
    return NextResponse.json(result);
  },
);
```

### UI

- Reuse primitives from `src/components/ui` — no one-off buttons/inputs.
- Server components fetch via services; client components use `api()` + `router.refresh()`.
- Confirmation modals are required for critical actions (appoint/dismiss, role grants,
  budget transactions, status changes).

## Tests

Put tests in `tests/*.test.ts` (Vitest, no database needed — mock `@/db` and sibling services,
see `tests/budget.test.ts`). Cover new permission rules, validation schemas and ledger math.

## Commits & PRs

- Small, focused PRs; describe *why*, not just *what*.
- Link the issue the PR resolves.
- Screenshots for UI changes.
