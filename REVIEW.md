# REVIEW — RBAC audit: leadership dismissal, role assignment and user status

**Scope:** §2.1 (dismiss leader/deputy) and §2.2 (assign/remove roles, change user status) of the permission rules, checked against `src/lib/rbac/*`, the API routes, the services and the UI gates. All paths are relative to the repository root.

**Method:** read every server-side check (guard config → service → engine) and compared it line-by-line with the UI gating on the corresponding pages, then inventoried the test suite for coverage of each rule.

**Risk scale:** Critical = permission rule is wrong on the server (bypass or lockout). High = UI and server disagree, or a wrong gate survives the fix. Medium/Low = latent, cosmetic, or hygiene.

---

## 1. Findings

### F1 — Dismiss endpoint enforces `DISMISS_LEADER` for every position kind — **Critical**

- **File:** `src/app/api/leaders/[termId]/dismiss/route.ts`, lines 24–36
- **What's wrong:** the permission is hardcoded:

  ```ts
  const permission = "DISMISS_LEADER"; // refined below by term lookup
  ```

  The "term lookup" was never implemented — lines 24–34 are dead scaffolding: a self-join `eq(factionPositions.id, factionPositions.id)` (always true, joins the table to itself), `.limit(0)` (returns nothing by construction), `.catch(() => [])` (swallows DB errors), and `void pos` to silence the unused variable. The route docstring (line 13) states the intended rule: *"`DISMISS_LEADER` for leader positions, `MANAGE_DEPUTIES` for deputies"* — the code does not implement it.

- **Why it matters:** `dismissTerm` in `src/server/services/leadership.ts` (lines 314–381) performs **no** permission check — the route is the *only* gate. Consequences in both directions:
  - **Under-enforcement:** any actor holding `DISMISS_LEADER` but not `MANAGE_DEPUTIES` can dismiss deputies. With the seeded catalog these coincide, but roles are editable via `MANAGE_ROLES`/`MANAGE_PERMISSIONS`, so a custom role with `DISMISS_LEADER` alone gets deputy-dismissal it was never granted — a real privilege escalation against the spec (deputy → `MANAGE_DEPUTIES`).
  - **Over-enforcement:** the Senior Supervisor tier holds `MANAGE_DEPUTIES` but not `DISMISS_LEADER` (`src/lib/rbac/roles.ts`, `supervisorPermissions`: `MANAGE_DEPUTIES` enters at *senior*, `DISMISS_LEADER` only at *deputy_chief*). Senior Supervisors therefore **cannot dismiss deputies they are explicitly designed to manage** — the very tier the spec assigns this duty to is locked out.

- **Fix (mirrors `POST /api/leaders`, `src/app/api/leaders/route.ts` lines 32–44):**

  ```ts
  const rows = await db
    .select({ kind: factionPositions.kind })
    .from(leadershipTerms)
    .innerJoin(factionPositions, eq(factionPositions.id, leadershipTerms.positionId))
    .where(eq(leadershipTerms.id, termId))
    .limit(1);
  if (!rows[0]) throw errors.notFound("Term not found.");

  const permission = rows[0].kind === "deputy" ? "MANAGE_DEPUTIES" : "DISMISS_LEADER";
  const decision = can(auth.actor, permission, scope);
  if (!decision.allowed) {
    throw errors.forbidden(`Missing permission: ${permission}.`, decision.reason ?? "FORBIDDEN");
  }
  ```

  This also removes the dead join, the `.catch()` that masked DB failures, and returns 404 instead of a misleading 403 for a nonexistent term (the current code evaluates `DISMISS_LEADER` against an unknown kind before `dismissTerm` would 404). The `scope` check via `departmentOfTerm` stays as-is.

- **Note:** the correct implementation already exists in the stray backup `src/app/api/leaders/[termId]/dismiss/route.ts.real` (lines 25–36) — port it (using the drizzle join above rather than raw `db.execute`) and delete the backup (see F5).

### F2 — Deputies page gates dismissal on the wrong permission — **High**

- **File:** `src/app/(app)/deputies/page.tsx`, lines 51–52
- **What's wrong:**

  ```ts
  // The dismiss endpoint checks DISMISS_LEADER regardless of position kind.
  const canDismiss = auth.permissions.has("DISMISS_LEADER");
  ```

  The comment documents the bug as if it were the rule. Today this is *consistently wrong* with F1 (both hide dismiss from `MANAGE_DEPUTIES`-only actors); the moment F1 is fixed, the UI starts **hiding a right the server would grant** — every Senior/Deputy-Chief Supervisor loses the dismiss control on the Deputies page.

- **Fix:** `const canDismiss = auth.permissions.has("MANAGE_DEPUTIES");` and replace the comment (all deputy rows are `kind = "deputy"`, since the page queries `listTerms({ kind: "deputy", … })` at line 43). Best structure: share one pure helper with the route (see T1) so UI and server can never drift again.

### F3 — Leader history page shows mixed kinds behind a single dismiss gate — **High**

- **Files:** `src/app/(app)/leaders/[userId]/page.tsx` line 51 + lines 101–108; `src/components/leadership/row-actions.tsx` lines 11–17, 41–42
- **What's wrong:** this page loads **all** terms of a user — `listTerms({ userId, … })` has no `kind` filter, so rows are leaders *and* deputies (the table itself renders a Leader/Deputy badge per row, and the disciplinary section below uses `term.positionKind`). Yet one page-level flag is passed to every row:

  ```ts
  const canDismiss = auth.permissions.has("DISMISS_LEADER");
  …
  <RowActions term={term} canDismiss={canDismiss} … />
  ```

  After F1, a deputy term row on this page would still be gated by `DISMISS_LEADER`: a `MANAGE_DEPUTIES`-only actor sees no dismiss control on the deputy card (server would allow it), while a `DISMISS_LEADER`-only actor sees dismiss on the *leader* card and gets a confusing 403 on the deputy card. `RowActionTerm` has no `positionKind`, so `RowActions` cannot tell the kinds apart.

- **Fix (minimal, no component API change needed):** compute the flag **per row** where the kind is known:

  ```tsx
  const canDismissLeader = auth.permissions.has("DISMISS_LEADER");
  const canManageDeputies = auth.permissions.has("MANAGE_DEPUTIES");
  …
  <RowActions
    term={term}
    canDismiss={term.positionKind === "deputy" ? canManageDeputies : canDismissLeader}
    …
  />
  ```

  `listTerms` already returns `positionKind` (it is used at `src/app/(app)/users/[userId]/page.tsx` line 278), so no service change is required. Alternatively add `positionKind` to `RowActionTerm` and gate inside `RowActions` — either way the two flags must both be consulted.

- **Not a problem:** `src/app/(app)/leaders/page.tsx` line 51 uses a single `DISMISS_LEADER` flag, but that page queries `kind: "leader"` only (line 43) — one kind, one flag, correct both before and after F1. Likewise `deputies/page.tsx` → `DeputiesTable` rows are all deputies. The read-only leadership table on `users/[userId]` renders no actions at all. Only the *mixed* history page (F3) needs per-row logic.

### F4 — Comments documenting the superseded rule — **Low**

- **Files:** `src/components/leadership/deputies-table.tsx` lines 19–23; `src/app/(app)/deputies/page.tsx` line 51
- **What's wrong:** the `DeputiesTable` docstring states *“Dismiss is gated by DISMISS_LEADER — that is the permission the dismiss endpoint enforces for every term kind.”* After F1+F2 this becomes actively misleading for the next maintainer (it is the exact text that led the UI astray).
- **Fix:** rewrite both to *“Dismiss of a deputy term requires MANAGE_DEPUTIES — the endpoint picks the permission by position kind.”*

### F5 — Divergent backup of a security-critical route is committed — **Low**

- **File:** `src/app/api/leaders/[termId]/dismiss/route.ts.real`
- **What's wrong:** a `.real` backup of the *correct* implementation sits next to the live buggy file, inside `src/app/api/` (Next.js route tree). Two sources of truth for one permission check; it can be mistaken for a route, and it proves the fix was stashed instead of applied.
- **Fix:** port its logic into `route.ts` (F1), delete `route.ts.real`, and add `*.real` (plus `*.bak`) to `.gitignore`.

### F6 — Permission-subset check ignores department scoping (latent) — **Low**

- **Files:** `src/server/services/users.ts` lines 461–475 (`assignRole`); `src/app/(app)/users/page.tsx` lines 36–38 and `src/app/(app)/users/[userId]/page.tsx` lines 41–43 (`computeAssignableRoles`)
- **What's wrong:** the “you can never grant a permission you do not hold” check compares bare permission **keys** (`auth.permissions.has(p)`, `actorPerms.has(k)`) and discards *where* the actor holds them. An actor holding `MANAGE_ROLES` only in department A could be offered (and, server-side, approve) a **global** role whose permissions they only hold in A — scope-escalation.
- **Why it's Low, not High:** unreachable with the current catalog — `MANAGE_ROLES` exists only on the four global critical roles (`rbac-catalog.test.ts` line 83 asserts exactly that), and every scoped supervisor role has `managesAdminRoles: false`. It becomes a live escalation path the day anyone seeds a *scoped* role with `MANAGE_ROLES`.
- **Fix (when convenient):** when the assigner is scoped (`actorDepartments(actor) !== null`), restrict assignable roles to `role.departmentId === actor's department` (or require global actors for global roles); mirror the same condition in the server-side subset check.

### F7 — “Granted by —” placeholder hides role-assignment provenance — **Low**

- **File:** `src/components/users/roles-card.tsx` line 87
- **What's wrong:** the card renders a hardcoded `Granted by —` although `getUserDetail` already fetches `assignedBy` (`users.ts` line 216) — the `ProfileRole` interface simply drops it. Audit entries do record `ASSIGN_ROLE`, so this is traceability/UX, not a security gap.
- **Fix:** add `assignedBy` to `ProfileRole`, thread it through, render `Granted by #N` (or hide the clause until it is wired).

### Verified correct (no finding)

- **User status:** `POST /api/users/:id/status` → guard `permission: "BLOCK_USERS"` + per-target `scope: departmentOfUser` (`status/route.ts` line 18–20); service rejects self-change (`SELF_ACTION`, `users.ts` line 336) and equal/higher-level targets (`HIERARCHY_VIOLATION`, lines 342–345, Founder exempt), writes audit, notifies. UI gates on `BLOCK_USERS` (`users/page.tsx` line 92, profile line 98) — server and UI agree; `StatusDialog` enforces reason ≥ 3 chars, matching the zod schema.
- **Role assignment:** `POST /api/users/:id/roles` → guard `MANAGE_ROLES` + 30/min rate limit; service chain = self-block → `canAssignRole` (level + critical-4 for `administration` category) → `canManageAdminUsers` → cannot-grant-unheld-permissions → target-equal/higher-level block → duplicate conflict (`users.ts` lines 437–517). `DELETE …/roles/:roleKey` mirrors it (lines 519–572). UI (`computeAssignableRoles` + `MANAGE_ROLES` gate) pre-filters by the same `canAssignRole`/admin/subset rules — deliberately a *subset* of the server checks.
- **Hierarchy-ineligible targets are not pre-hidden:** the profile/list pages show “Assign role”/“Change status” even when the *target* outranks the actor; the server rejects with `HIERARCHY_VIOLATION`. This complies with the project rule (hiding a button is never a security measure) — server enforcement exists, hiding it too would be optional polish only.
- **Engine & catalog:** `can()`/`canAssignRole()`/`canGrantPermission()`/`canManageAdminUsers()` in `src/lib/rbac/engine.ts` implement every §RBAC rule (Founder exemption, critical-4, grant-only-what-you-hold, scope), and both are heavily unit-tested (see §2).

---

## 2. Tests

### Existing coverage (7 suites, 105 tests)

| Suite | What it covers | Relevance to this audit |
|---|---|---|
| `tests/rbac-engine.test.ts` (281 lines) | `can()` (Founder/all-perms, unknown-perm, inactive account), scope (in-dept/out-of-dept/global/unscoped), `canAssignRole()` (level cap, critical-4-only for administration, `managesAdminRoles` flag set), `canGrantPermission()` (grant-only-what-you-hold, Deputy-Chief cannot grant `SYSTEM_SETTINGS`), `canManageAdminUsers()`, helpers | Fully covers the **rules engine** behind both audited areas |
| `tests/rbac-catalog.test.ts` | 36 permissions / 39 roles, unique keys, tier superset ordering, exactly-four `managesAdminRoles`, `MANAGE_ROLES`/`MANAGE_ADMINS` holders = critical 4, level ordering, player view-only | Locks the catalog that F1/F6 depend on (incl. `MANAGE_DEPUTIES` vs `DISMISS_LEADER` tier split being *correct in the catalog*) |
| `tests/leadership-schema.test.ts` | `appointSchema`, `dismissSchema` (reason 3–500, ISO date), `pointsSchema`, `disciplinarySchema`, `termQuerySchema` | Covers **input validation** of dismissal — not its permission |
| `tests/guard.test.ts` | method/auth/403-permission/scope-403/422-body/429-`Retry-After`/500-sanitization, handler context contract | Covers the **pipeline** every audited route runs through |
| `tests/session.test.ts` | JWT session sign/verify/revocation | Auth area |
| `tests/budget.test.ts` | budget ledger rules | Out of this audit's scope |
| `tests/utils.test.ts` | formatting helpers | — |

**Gap:** not a single test exercises **which** permission the dismiss/appoint endpoints require, nor the role/status **services** — exactly the seam where F1 hid. Schema tests prove the dismissal *reason* is valid; nothing proves the dismissal *actor* is authorized correctly.

### Missing tests worth adding

1. **T1 — kind → permission mapping (prevents F1 from recurring).** Extract a pure helper, e.g. `src/lib/rbac/term-permissions.ts`:

   ```ts
   export const dismissPermissionForKind = (kind: string) =>
     kind === "deputy" ? "MANAGE_DEPUTIES" : "DISMISS_LEADER";
   export const appointPermissionForKind = (kind: string) =>
     kind === "deputy" ? "MANAGE_DEPUTIES" : "APPOINT_LEADER";
   ```

   Use it in **both** the dismiss route (F1), the appoint route (`leaders/route.ts` line 40), and the UI gates (F2/F3) — one implementation, one test, zero drift. New `tests/term-permissions.test.ts`: deputy → `MANAGE_DEPUTIES`; leader → `DISMISS_LEADER`/`APPOINT_LEADER`; unknown/corrupt kind fails to the leader permission (fail-closed).
2. **T2 — dismiss route authorization (integration, mocked `db`).** `vi.mock("@/db")` returning a deputy term: actor with only `MANAGE_DEPUTIES` → 200; same actor on a leader term → 403 with `Missing permission: DISMISS_LEADER.`; unknown term id → 404; the mock pattern is already established in `guard.test.ts`.
3. **T3 — `setUserStatus` service rules (mocked `db`).** self-change → `SELF_ACTION` conflict; target level ≥ actor level → `HIERARCHY_VIOLATION`; Founder bypasses the hierarchy check. None of these three lines (`users.ts` 336, 342–345) is currently under test.
4. **T4 — `assignRole`/`removeRole` service rules (mocked `db`).** cannot grant permissions you don't hold → `CANNOT_GRANT_PERMISSION`; administration category without the critical-4 → forbidden; target equal level → `HIERARCHY_VIOLATION`; duplicate assignment → `ROLE_ALREADY_ASSIGNED`; self-change → `SELF_ACTION`. The engine primitives are tested (T-suite above); the service composition is not.
5. **T5 (optional) — UI/server mirror.** Component tests would need React Testing Library (not installed). With T1 making the gates share the route's helper, the expensive half of this problem disappears; a cheap static check (grep-style assertion that `deputies/page.tsx` imports `dismissPermissionForKind("deputy")` rather than spelling a permission key inline) is possible but brittle — recommended only if T1's shared-helper refactor is deferred.

---

## 3. Top-priority fixes

1. **[Critical] F1 — make the dismiss route pick the permission by position kind.** Replace lines 24–36 of `src/app/api/leaders/[termId]/dismiss/route.ts` with the drizzle join + `kind === "deputy" ? "MANAGE_DEPUTIES" : "DISMISS_LEADER"` (sketch above), add the 404 for an unknown term, delete the dead self-join/`.limit(0)`/`.catch`/`void pos`. This is the only enforcement point (`dismissTerm` checks nothing) and it is wrong in both directions today.
2. **[High] F2 — flip the Deputies page gate to `MANAGE_DEPUTIES`** in `src/app/(app)/deputies/page.tsx` (line 52) and replace the stale comment (line 51). Must ship **in the same change** as #1: after the route is fixed, the old UI gate hides a right the server grants (Senior Supervisors lose dismissal entirely).
3. **[High] F3 — per-row kind-aware dismiss gating on the mixed history page** (`src/app/(app)/leaders/[userId]/page.tsx`): compute `canDismiss` per term from `term.positionKind` (`deputy → MANAGE_DEPUTIES`, else `DISMISS_LEADER`) instead of one page-level flag. The single-kind pages (`leaders`, `deputies`) stay as they are.
4. **[High] T1 + T2 — lock the fix with tests.** Extract the shared kind→permission helper (used by route *and* both UI gates), add its unit test and the mocked-`db` route test asserting `MANAGE_DEPUTIES` suffices for a deputy term and 403s a leader term. This is the regression that 105 passing tests did not catch.
5. **[Low] F4 + F5 — hygiene:** delete `route.ts.real` (after porting), rewrite the two comments that document the old rule (`deputies-table.tsx` 19–23, `deputies/page.tsx` 51), add `*.real`/`*.bak` to `.gitignore`.
6. **[Low, scheduled] T3 + T4** for the status/role services, then **F6** (scope-aware assignable-role filtering) and **F7** (`Granted by` provenance) as follow-ups — none is exploitable with the seeded catalog today.

**Validation after 1–5:** run the gates sequentially — `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build` (never two `next build` in parallel) — then fold into the pending root commit.
