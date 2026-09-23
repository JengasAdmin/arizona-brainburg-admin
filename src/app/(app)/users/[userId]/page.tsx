import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, UserCog } from "lucide-react";
import { requirePageAuth } from "@/server/page-auth";
import type { AuthContext } from "@/server/auth/access";
import { ApiError } from "@/server/http";
import { getUserDetail } from "@/server/services/users";
import { listTerms } from "@/server/services/leadership";
import { listActivity } from "@/server/services/activity";
import { listDepartments, listRolesWithPermissions } from "@/server/services/roles-admin";
import { canAssignRole, canManageAdminUsers, isFounder } from "@/lib/rbac/engine";
import { isPermissionKey } from "@/lib/rbac/permissions";
import { PageHeader, StatCard } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime, plural } from "@/lib/utils";
import { EntityAuditList } from "@/components/audit/entity-audit-list";
import { GameIdDialog } from "@/components/users/game-id-dialog";
import { ProfileDialog } from "@/components/users/profile-dialog";
import { ProfileTabs } from "@/components/users/profile-tabs";
import { RoleAssignDialog, type AssignableRole } from "@/components/users/role-assign-dialog";
import { RolesCard } from "@/components/users/roles-card";
import { StatusDialog } from "@/components/users/status-dialog";

export const dynamic = "force-dynamic";

/** Roles this actor may actually grant to this target (server-side computed). */
async function computeAssignableRoles(auth: AuthContext): Promise<AssignableRole[]> {
  const [allRoles, departments] = await Promise.all([listRolesWithPermissions(), listDepartments()]);
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
  const founder = isFounder(auth.actor);
  const canManageAdmins = canManageAdminUsers(auth.actor).allowed;

  return allRoles
    .filter((role) => canAssignRole(auth.actor, role).allowed)
    .filter((role) => role.category !== "administration" || canManageAdmins)
    .filter((role) =>
      founder || role.permissions.every((p) => isPermissionKey(p) && auth.permissions.has(p)),
    )
    .map((role) => ({
      key: role.key,
      title: role.name,
      scope:
        role.departmentId == null
          ? "Global"
          : (departmentNames.get(role.departmentId) ?? "Scoped"),
    }));
}

function providerLabel(provider: string): string {
  if (provider === "discord") return "Discord";
  if (provider === "vk") return "VK";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const auth = await requirePageAuth("VIEW_PROFILES");
  const { userId: rawUserId } = await params;
  const userId = Number.parseInt(rawUserId, 10);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const detail = await getUserDetail(userId, auth.actor).catch((err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 403) return null;
    }
    throw err;
  });

  if (!detail) {
    return (
      <div>
        <PageHeader title="User profile" description={`User ID #${userId}`} />
        <Card>
          <EmptyState
            icon={<Lock className="h-8 w-8" />}
            title="No access to this profile"
            description="This account is outside your scope, or you lack the required permission."
          />
        </Card>
      </div>
    );
  }

  const [terms, activity] = await Promise.all([
    listTerms({ userId, page: 1, pageSize: 100 }, auth.actor),
    listActivity({ userId, page: 1, pageSize: 50 }, auth.actor),
  ]);

  const canEditStatus = auth.permissions.has("BLOCK_USERS");
  const canEditGameId = auth.permissions.has("EDIT_PROFILES");
  const canEditProfile = auth.permissions.has("EDIT_PROFILES");
  const canAssignRoles = auth.permissions.has("MANAGE_ROLES");
  const canLogActivity = auth.permissions.has("CREATE_GAME_ACTIVITY");
  const canViewAudit = auth.permissions.has("VIEW_AUDIT_LOGS");

  const assignableRoles = canAssignRoles ? await computeAssignableRoles(auth) : [];
  const assignedKeys = detail.roles.map((role) => role.key);
  const availableAssignable = assignableRoles.filter((role) => !assignedKeys.includes(role.key));

  const warnings = terms.items.reduce((sum, term) => sum + term.warningsCount, 0);
  const reprimands = terms.items.reduce((sum, term) => sum + term.reprimandsCount, 0);
  const activeTerm = terms.items.find((term) => term.status === "active") ?? null;

  const hasProfileData = Boolean(
    detail.user.nickname ||
      detail.user.branch ||
      detail.user.statusReason ||
      detail.providers.length > 0 ||
      activeTerm,
  );

  const headerActions = (
    <>
      {canEditStatus ? (
        <StatusDialog
          userId={userId}
          currentStatus={detail.user.status}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
            >
              Change status
            </button>
          }
        />
      ) : null}
      {canEditGameId ? (
        <GameIdDialog
          userId={userId}
          currentGameId={detail.user.gameId}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
            >
              Edit game ID
            </button>
          }
        />
      ) : null}
      {canAssignRoles && availableAssignable.length > 0 ? (
        <RoleAssignDialog
          userId={userId}
          roles={assignableRoles}
          assignedKeys={assignedKeys}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
            >
              Assign role
            </button>
          }
        />
      ) : null}
      {canEditProfile ? (
        <ProfileDialog
          userId={userId}
          values={{
            displayName: detail.user.displayName,
            nickname: detail.user.nickname,
            branch: detail.user.branch,
          }}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
            >
              Edit profile
            </button>
          }
        />
      ) : null}
      {canLogActivity ? (
        <Link
          href={`/activity?userId=${userId}`}
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-[#262626] hover:text-white"
        >
          Log activity
        </Link>
      ) : null}
    </>
  );

  const overviewPanel = hasProfileData ? (
    <Card>
      <CardHeader
        title="Profile"
        description="Identity and contact data of this account."
      />
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nickname">{detail.user.nickname ?? "—"}</Field>
        <Field label="Branch">{detail.user.branch ?? "—"}</Field>
        <Field label="Game ID">
          <span className="flex items-center gap-1.5 text-[13px] text-neutral-200">
            {detail.user.gameId ?? "—"}
            {detail.user.gameId ? (
              <Badge tone={detail.user.gameIdVerifiedAt ? "ok" : "warn"}>
                {detail.user.gameIdVerifiedAt ? "Verified" : "Unverified"}
              </Badge>
            ) : null}
          </span>
        </Field>
        <Field label="Faction position">
          {activeTerm ? `${activeTerm.positionTitle} — ${activeTerm.factionName}` : "—"}
        </Field>
        <Field label="Status reason">{detail.user.statusReason ?? "—"}</Field>
        <Field label="Registration source">{providerLabel(detail.user.registrationSource)}</Field>
        {detail.providers.map((provider) => (
          <Field key={provider.provider} label={providerLabel(provider.provider)}>
            {provider.username ?? provider.displayName ?? "—"}
          </Field>
        ))}
        <Field label="Registered">{formatDateTime(detail.user.createdAt)}</Field>
        <Field label="Last login">{formatDateTime(detail.user.lastLoginAt)}</Field>
      </div>
    </Card>
  ) : (
    <Card>
      <EmptyState icon={<UserCog className="h-8 w-8" />} title="No profile data" />
    </Card>
  );

  const historyPanel = canViewAudit ? (
    <EntityAuditList entityType="user" entityId={userId} />
  ) : (
    <Card>
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="No access to the audit log"
        description="You need the View audit logs permission to see this history."
      />
    </Card>
  );

  const leadershipPanel = terms.items.length === 0 ? (
    <Card>
      <EmptyState
        title="No leadership terms"
        description="This user has never held a leader or deputy position."
      />
    </Card>
  ) : (
    <Card>
      <CardHeader
        title="Leadership history"
        description={`${plural(terms.total, "term", "terms")} — active and closed.`}
      />
      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <THead>
            <TR>
              <TH>Position</TH>
              <TH>Faction (scope)</TH>
              <TH>Term</TH>
              <TH>Start</TH>
              <TH>End</TH>
              <TH>Status</TH>
              <TH>Appointed by</TH>
            </TR>
          </THead>
          <TBody>
            {terms.items.map((term) => (
              <TR key={term.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-200">{term.positionTitle}</span>
                    <Badge tone={term.positionKind === "leader" ? "info" : "neutral"}>
                      {term.positionKind === "leader" ? "Leader" : "Deputy"}
                    </Badge>
                  </div>
                </TD>
                <TD>
                  <div className="text-neutral-300">{term.factionName}</div>
                  <div className="text-[11px] text-neutral-600">{term.factionShort}</div>
                </TD>
                <TD className="whitespace-nowrap text-neutral-500">
                  #{term.termNumber} · rank {term.rank}
                </TD>
                <TD className="whitespace-nowrap text-neutral-500">
                  {formatDate(term.appointedAt)}
                </TD>
                <TD className="whitespace-nowrap text-neutral-500">
                  {term.dismissedAt ? formatDate(term.dismissedAt) : "—"}
                </TD>
                <TD>
                  <StatusBadge status={term.status} />
                </TD>
                <TD className="text-neutral-400">{term.appointedBy ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );

  const activityPanel = activity.items.length === 0 ? (
    <Card>
      <EmptyState
        title="No activity recorded yet"
        description="Manual and integration game activity will appear here."
      />
    </Card>
  ) : (
    <Card>
      <CardHeader title="Game activity" description={`${plural(activity.total, "entry", "entries")}.`} />
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>User</TH>
              <TH>Action</TH>
              <TH>Description</TH>
              <TH>Result</TH>
            </TR>
          </THead>
          <TBody>
            {activity.items.map((item) => (
              <TR key={item.id}>
                <TD className="whitespace-nowrap text-neutral-500">
                  {formatDateTime(item.occurredAt)}
                </TD>
                <TD>
                  <div className="text-neutral-200">{item.displayName}</div>
                  <div className="text-[11px] text-neutral-600">{item.nickname ?? "—"}</div>
                </TD>
                <TD>
                  <Badge tone="neutral">{item.action}</Badge>
                </TD>
                <TD className="max-w-[320px]">
                  <div className="truncate text-neutral-300" title={item.description}>
                    {item.description}
                  </div>
                  <div className="text-[11px] text-neutral-600">{item.factionName ?? "—"}</div>
                </TD>
                <TD>
                  <Badge tone={item.source === "manual" ? "neutral" : "info"}>{item.source}</Badge>
                  <div className="mt-0.5 text-[11px] text-neutral-600">
                    {item.createdBy ?? "—"}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar src={detail.user.avatarUrl} name={detail.user.displayName} size={40} />
            <span className="min-w-0">
              <span className="block truncate">{detail.user.displayName}</span>
              <span className="block text-xs font-normal text-neutral-500">
                User ID #{detail.user.id}
                {detail.user.nickname ? ` · ${detail.user.nickname}` : ""}
              </span>
            </span>
            <StatusBadge status={detail.user.status} />
          </span>
        }
        description={
          <>
            Game ID {detail.user.gameId ?? "—"}
            {detail.user.gameId
              ? detail.user.gameIdVerifiedAt
                ? " (verified)"
                : " (unverified)"
              : ""}
            {" · "}Registered {formatDate(detail.user.createdAt)}
          </>
        }
        actions={headerActions}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Assigned roles" value={detail.roles.length} />
        <StatCard label="Warnings" value={warnings} />
        <StatCard label="Reprimands" value={reprimands} />
        <StatCard label="Last seen" value={formatDateTime(detail.user.lastLoginAt)} />
      </div>

      <ProfileTabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "roles", label: "Roles", badge: detail.roles.length },
          { key: "history", label: "History" },
          { key: "leadership", label: "Leadership", badge: terms.total },
          { key: "activity", label: "Activity", badge: activity.total },
        ]}
        panels={{
          overview: overviewPanel,
          roles: (
            <RolesCard
              userId={userId}
              roles={detail.roles}
              canAssign={canAssignRoles && availableAssignable.length > 0}
              assignableRoles={assignableRoles}
            />
          ),
          history: historyPanel,
          leadership: leadershipPanel,
          activity: activityPanel,
        }}
      />
    </div>
  );
}
