import { requirePageAuth } from "@/server/page-auth";
import { listRolesWithPermissions, listDepartments } from "@/server/services/roles-admin";
import { PageHeader } from "@/components/page-header";
import {
  CreateRoleButton,
  RolesTable,
  type BandId,
  type RoleGroup,
  type RoleRow,
} from "@/components/admin/roles-table";
import { DEPARTMENTS, FOUNDER_ROLE_KEY, ROLE_MAP, type RoleDefinition } from "@/lib/rbac/roles";
import {
  canAssignRole,
  canGrantPermission,
  canManageAdminUsers,
  isFounder,
  maxLevel,
} from "@/lib/rbac/engine";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  scope?: string;
  page?: string;
}

const BANDS: { id: BandId; label: string; hint: string }[] = [
  { id: "founder", label: "Founder", hint: "Absolute system level — permission set is immutable." },
  {
    id: "leadership",
    label: "Government leadership",
    hint: "Chief Administrator, Deputy Chief Administrator and Curator.",
  },
  { id: "supervisors", label: "Department supervisors", hint: "Eight supervision directions × four tiers." },
  { id: "admin-tiers", label: "Administrative tiers", hint: "Administrator Level 4 and Level 3." },
  { id: "player", label: "Player & custom roles", hint: "Default player role and custom-created roles." },
];

function bandOf(role: { key: string; category: string; level: number }): BandId {
  if (role.key === FOUNDER_ROLE_KEY) return "founder";
  if (role.category === "administration") return role.level >= 80 ? "leadership" : "admin-tiers";
  if (role.category === "supervision") return "supervisors";
  return "player";
}

function catalogRole(key: string): RoleDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(ROLE_MAP, key) ? ROLE_MAP[key] : undefined;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const auth = await requirePageAuth("MANAGE_ROLES");
  const sp = await searchParams;

  // listRolesWithPermissions() accepts no arguments — q/scope/page are applied here.
  const [roles, dbDepartments] = await Promise.all([
    listRolesWithPermissions(),
    listDepartments(),
  ]);

  const departments = dbDepartments.map((d) => ({ id: d.id, key: d.key, name: d.name }));
  const deptNameByKey = new Map<string, string>(departments.map((d) => [d.key, d.name]));
  for (const catalogDept of DEPARTMENTS) {
    if (!deptNameByKey.has(catalogDept.key)) deptNameByKey.set(catalogDept.key, catalogDept.name);
  }

  const founderActor = isFounder(auth.actor);

  const rows: RoleRow[] = roles.map((r) => {
    const catalog = catalogRole(r.key);
    const base = catalog?.permissions;
    const isCustom = !base ? true : !sameSet(r.permissions, base);
    const departmentName = r.departmentKey ? deptNameByKey.get(r.departmentKey) ?? r.departmentKey : null;
    const canAssign = canAssignRole(auth.actor, { key: r.key, level: r.level, category: r.category });
    const canReset =
      catalog !== undefined &&
      r.key !== FOUNDER_ROLE_KEY &&
      isCustom &&
      canAssign.allowed &&
      catalog.permissions.every((k) => canGrantPermission(auth.actor, k).allowed);

    return {
      key: r.key,
      name: r.name,
      description: r.description ?? "",
      level: r.level,
      category: r.category,
      band: bandOf(r),
      departmentKey: r.departmentKey,
      departmentName,
      memberCount: r.memberCount,
      permissionCount: r.permissions.length,
      baseCount: base ? base.length : null,
      isCustom,
      base: base ? [...base] : null,
      canReset,
    };
  });

  // Toolbar filters (server-side — the service itself has no filter arguments).
  const q = (sp.q ?? "").trim().toLowerCase();
  const scope = (sp.scope ?? "").trim();
  let filtered = rows;
  if (q) {
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }
  if (scope === "global") {
    filtered = filtered.filter((r) => r.departmentKey === null);
  } else if (scope) {
    filtered = filtered.filter((r) => r.departmentKey === scope);
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), pages)
    : 1;
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groups: RoleGroup[] = BANDS.map((band) => ({
    ...band,
    roles: slice.filter((r) => r.band === band.id),
  })).filter((g) => g.roles.length > 0);

  const canCreate = founderActor || maxLevel(auth.actor) > 0;
  const maxCreateLevel = founderActor ? 99 : maxLevel(auth.actor);
  const canCreateAdminRoles = canManageAdminUsers(auth.actor).allowed;

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Hierarchy bands, scope and permission sets — each role is edited on its own page."
        actions={
          canCreate ? (
            <CreateRoleButton
              departments={departments}
              canCreateAdminRoles={canCreateAdminRoles}
              maxCreateLevel={maxCreateLevel}
            />
          ) : null
        }
      />

      <RolesTable
        groups={groups}
        q={(sp.q ?? "").trim()}
        scope={scope}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        departments={departments}
      />
    </div>
  );
}
