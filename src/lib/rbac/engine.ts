import type { PermissionKey } from "./permissions";
import { isPermissionKey } from "./permissions";
import { FOUNDER_ROLE_KEY } from "./roles";

/**
 * Pure RBAC engine — no I/O, fully unit-testable.
 *
 * Rules implemented here (see README §RBAC):
 *  1. Every check happens on the SERVER. The frontend only hides what it cannot show.
 *  2. A role with `departmentId = null` grants its permissions GLOBALLY.
 *  3. A role with `departmentId = X` grants its permissions ONLY inside department X.
 *  4. Roles may never manage/assign roles above their own hierarchy level
 *     (Founder is exempt — full access).
 *  5. You can never grant a permission you do not hold yourself (Founder exempt).
 *  6. Only roles flagged `managesAdminRoles` (Founder/Chief/Deputy Chief/Curator)
 *     may assign administrative roles or edit permission sets.
 */

export interface ActorRole {
  key: string;
  name: string;
  level: number;
  category: string;
  managesAdminRoles: boolean;
  departmentId: number | null;
  permissions: string[];
}

export interface Actor {
  userId: number;
  status: string;
  roles: ActorRole[];
}

/** A request may be scoped to a department (or global when omitted). */
export interface Scope {
  departmentId?: number | null;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
}

const deny = (reason: string): AccessDecision => ({ allowed: false, reason });
const allow: AccessDecision = { allowed: true };

export function isFounder(actor: Actor): boolean {
  return actor.roles.some((role) => role.key === FOUNDER_ROLE_KEY);
}

export function maxLevel(actor: Actor): number {
  return actor.roles.reduce((max, role) => Math.max(max, role.level), 0);
}

/** Departments the actor is scoped to. `null` means "global (all departments)". */
export function actorDepartments(actor: Actor): number[] | null {
  if (isFounder(actor)) return null;
  if (actor.roles.some((role) => role.departmentId === null)) return null;
  const ids = actor.roles
    .map((role) => role.departmentId)
    .filter((id): id is number => typeof id === "number");
  return ids.length > 0 ? [...new Set(ids)] : [];
}

function roleGrants(actor: Actor, permission: PermissionKey, scope?: Scope): boolean {
  for (const role of actor.roles) {
    if (!role.permissions.includes(permission)) continue;
    // Global role → grants everywhere.
    if (role.departmentId === null) return true;
    // Scoped role → only inside its own department (or the requested department).
    if (scope?.departmentId != null && scope.departmentId === role.departmentId) return true;
    // Listing/fetch without an explicit scope still passes if the actor holds the
    // permission in at least one department — the query layer filters rows by scope.
    if (scope === undefined) return true;
  }
  return false;
}

/**
 * Core permission check.
 * `scope` describes what the request touches; omit it for global operations.
 */
export function can(actor: Actor, permission: PermissionKey | string, scope?: Scope): AccessDecision {
  if (!isPermissionKey(permission)) return deny("UNKNOWN_PERMISSION");
  if (actor.status !== "active") return deny("ACCOUNT_NOT_ACTIVE");
  if (isFounder(actor)) return allow;
  if (roleGrants(actor, permission, scope)) return allow;
  return deny("MISSING_PERMISSION");
}

export function has(actor: Actor, permission: PermissionKey, scope?: Scope): boolean {
  return can(actor, permission, scope).allowed;
}

/** May this actor assign/managed the given target role? */
export function canAssignRole(
  actor: Actor,
  targetRole: { key: string; level: number; category?: string },
): AccessDecision {
  if (isFounder(actor)) return allow;

  const manageDecision = can(actor, "MANAGE_ROLES");
  if (!manageDecision.allowed) return deny("MISSING_MANAGE_ROLES");

  const actorLevel = maxLevel(actor);
  if (targetRole.level > actorLevel) return deny("ROLE_ABOVE_OWN_LEVEL");

  // Only the four critical roles (Founder/Chief/Deputy Chief/Curator) may touch
  // administrative roles at all.
  if (targetRole.category === "administration" && !actor.roles.some((role) => role.managesAdminRoles)) {
    return deny("NOT_ALLOWED_TO_MANAGE_ADMINS");
  }

  return allow;
}

/** May this actor grant this permission to somebody (directly or via a role edit)? */
export function canGrantPermission(actor: Actor, permission: PermissionKey | string): AccessDecision {
  if (isFounder(actor)) return allow;

  const managePermDecision = can(actor, "MANAGE_PERMISSIONS");
  if (!managePermDecision.allowed) return deny("MISSING_MANAGE_PERMISSIONS");

  if (!isPermissionKey(permission)) return deny("UNKNOWN_PERMISSION");
  if (!has(actor, permission)) return deny("CANNOT_GRANT_OWNLY_WHAT_YOU_HAVE");
  return allow;
}

/** Administrative changes require MANAGE_ADMINS + at least the critical role set. */
export function canManageAdminUsers(actor: Actor): AccessDecision {
  if (isFounder(actor)) return allow;
  const decision = can(actor, "MANAGE_ADMINS");
  if (!decision.allowed) return decision;
  if (!actor.roles.some((role) => role.managesAdminRoles)) {
    return deny("ROLE_CANNOT_MANAGE_ADMINS");
  }
  return allow;
}

/** Resolve the department a target user belongs to (for scoped checks). */
export function scopeForDepartment(departmentId: number | null | undefined): Scope {
  return { departmentId: departmentId ?? null };
}

export function summarizePermissions(actor: Actor): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const role of actor.roles) {
    for (const perm of role.permissions) {
      if (isPermissionKey(perm)) set.add(perm);
    }
  }
  return [...set];
}
