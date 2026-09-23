"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

export type BandId = "founder" | "leadership" | "supervisors" | "admin-tiers" | "player";

export interface RoleRow {
  key: string;
  name: string;
  description: string;
  level: number;
  category: string;
  band: BandId;
  departmentKey: string | null;
  departmentName: string | null;
  memberCount: number;
  /** Current stored permission set (service: listRolesWithPermissions). */
  permissionCount: number;
  /** Catalog default size — null for custom roles without a catalog entry. */
  baseCount: number | null;
  /** True when the stored set differs from the catalog base (or no catalog entry exists). */
  isCustom: boolean;
  /** Catalog default permission keys (null for custom roles) — used by "Reset". */
  base: string[] | null;
  /** Server-side canAssignRole() && base fully grantable && not the Founder role. */
  canReset: boolean;
}

export interface RoleGroup {
  id: BandId;
  label: string;
  hint: string;
  roles: RoleRow[];
}

interface DepartmentOption {
  id: number;
  key: string;
  name: string;
}

const BAND_TONE: Record<BandId, "solid" | "info" | "neutral"> = {
  founder: "solid",
  leadership: "info",
  supervisors: "neutral",
  "admin-tiers": "neutral",
  player: "neutral",
};

interface RolesTableProps {
  groups: RoleGroup[];
  q: string;
  scope: string;
  page: number;
  pageSize: number;
  total: number;
  departments: DepartmentOption[];
}

export function RolesTable({ groups, q, scope, page, pageSize, total, departments }: RolesTableProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [text, setText] = useState(q);
  const [resetRow, setResetRow] = useState<RoleRow | null>(null);
  const [resetting, setResetting] = useState(false);

  // Keep the local input in sync when the URL changes from the outside.
  useEffect(() => {
    setText(q);
  }, [q]);

  const buildHref = (over: { q?: string | null; scope?: string | null; page?: number | null }) => {
    const nextQ = over.q !== undefined ? over.q : q;
    const nextScope = over.scope !== undefined ? over.scope : scope;
    const nextPage = over.page !== undefined ? over.page : null;
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextScope) params.set("scope", nextScope);
    if (nextPage && nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/roles?${qs}` : "/admin/roles";
  };

  // Debounced navigation — filtering happens server-side in the page component.
  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => {
      router.replace(buildHref({ q: text.trim() || null, page: null }));
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, q]);

  const handleReset = async () => {
    if (!resetRow || !resetRow.base) return;
    setResetting(true);
    try {
      await api(`/api/admin/roles/${resetRow.key}/permissions`, {
        method: "PUT",
        body: { permissionKeys: resetRow.base },
      });
      toast({
        title: "Grants reset",
        description: `${resetRow.name} restored to its ${resetRow.base.length} catalog permissions.`,
        variant: "success",
      });
      setResetRow(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not reset grants", description: errorMessage(err), variant: "error" });
    } finally {
      setResetting(false);
    }
  };

  const hasFilters = Boolean(q || scope);

  return (
    <Card>
      <CardHeader
        title="Role hierarchy"
        description="Roles grouped by hierarchy band — Founder to Player."
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
          <Input
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Search roles…"
            aria-label="Search roles"
            className="pl-8 pr-3"
          />
        </div>
        <Select
          value={scope}
          onChange={(e) => router.replace(buildHref({ scope: e.currentTarget.value || null, page: null }))}
          aria-label="Filter by scope"
          className="w-full sm:w-48"
        >
          <option value="">All scopes</option>
          <option value="global">Global</option>
          {departments.map((dept) => (
            <option key={dept.key} value={dept.key}>
              {dept.name}
            </option>
          ))}
        </Select>
        {hasFilters ? (
          <Button size="sm" variant="ghost" onClick={() => { setText(""); router.replace("/admin/roles"); }}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-neutral-600">
          {total} {total === 1 ? "role" : "roles"}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No roles match your filters"
          description="Adjust the search or scope filter to see roles again."
        />
      ) : (
        <Table className="min-w-[760px]">
          <THead>
            <TR>
              <TH>Role</TH>
              <TH>Level</TH>
              <TH>Scope</TH>
              <TH>Permissions</TH>
              <TH align="right">Members</TH>
              <TH align="right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {groups.map((group) => (
              <Fragment key={group.id}>
                <TR className="bg-surface/60">
                  <td colSpan={6} className="border-b border-line px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {group.label}
                      </span>
                      <span className="text-[11px] text-neutral-600">{group.hint}</span>
                      <span className="ml-auto text-[11px] text-neutral-600">{group.roles.length}</span>
                    </div>
                  </td>
                </TR>
                {group.roles.map((row) => (
                  <TR key={row.key}>
                    <TD>
                      <div className="text-neutral-200" title={row.description || undefined}>
                        {row.name}
                      </div>
                      <div className="font-mono text-[11px] text-neutral-600">{row.key}</div>
                    </TD>
                    <TD>
                      <Badge tone={BAND_TONE[group.id]}>{row.level}</Badge>
                    </TD>
                    <TD>
                      {row.departmentName ? (
                        <Badge>{row.departmentName}</Badge>
                      ) : (
                        <Badge tone="info">Global</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-200">{row.permissionCount}</span>
                        {row.baseCount !== null && row.isCustom ? (
                          <Badge tone="warn">custom</Badge>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-600">base {row.baseCount ?? "—"}</div>
                    </TD>
                    <TD align="right">{row.memberCount}</TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/roles/${row.key}`}
                          className="rounded px-2 py-1 text-xs text-neutral-300 transition-colors hover:bg-raised hover:text-white"
                        >
                          Edit permissions
                        </Link>
                        {row.canReset ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Restore this role's catalog default permissions"
                            onClick={() => setResetRow(row)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Reset
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </Fragment>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(next) => router.push(buildHref({ page: next }))}
      />

      <ConfirmDialog
        open={resetRow !== null}
        loading={resetting}
        request={
          resetRow
            ? {
                title: "Reset custom grants?",
                description: `Restore the catalog default permission set for “${resetRow.name}”.`,
                fields: [
                  { label: "Role", value: resetRow.name },
                  { label: "Current set", value: `${resetRow.permissionCount} permissions` },
                  { label: "After reset", value: `${resetRow.base?.length ?? 0} permissions` },
                ],
                confirmLabel: "Reset grants",
                danger: true,
              }
            : null
        }
        onConfirm={handleReset}
        onCancel={() => setResetRow(null)}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Create role (POST /api/admin/roles exists with createRoleSchema)            */
/* -------------------------------------------------------------------------- */

type Category = "administration" | "supervision" | "player";

interface CreateRoleButtonProps {
  departments: DepartmentOption[];
  canCreateAdminRoles: boolean;
  maxCreateLevel: number;
}

export function CreateRoleButton({ departments, canCreateAdminRoles, maxCreateLevel }: CreateRoleButtonProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    level: "",
    category: "player" as Category,
    departmentId: "",
  });

  const close = () => {
    setOpen(false);
    setErrors({});
    setForm({ key: "", name: "", description: "", level: "", category: "player", departmentId: "" });
  };

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    const key = form.key.trim();
    const name = form.name.trim();
    const description = form.description.trim();
    const level = Number(form.level);

    if (!/^[a-z0-9_]{2,60}$/.test(key)) {
      nextErrors.key = "Lowercase letters, digits and underscores only (2–60 characters).";
    }
    if (name.length < 2 || name.length > 80) nextErrors.name = "2–80 characters.";
    if (description.length > 300) nextErrors.description = "Maximum 300 characters.";
    if (!Number.isInteger(level) || level < 0 || level > maxCreateLevel) {
      nextErrors.level = `Whole number between 0 and ${maxCreateLevel} (your own level).`;
    }
    if (form.category === "administration" && !canCreateAdminRoles) {
      nextErrors.category = "Only critical roles may create administrative roles.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const res = await api<{ roleKey: string; id: number }>("/api/admin/roles", {
        method: "POST",
        body: {
          key,
          name,
          description: description || undefined,
          level,
          category: form.category,
          departmentId: form.departmentId ? Number(form.departmentId) : null,
          permissionKeys: [],
        },
      });
      toast({
        title: "Role created",
        description: `${res.roleKey} — open it to assign permissions.`,
        variant: "success",
      });
      close();
      router.refresh();
    } catch (err) {
      toast({ title: "Could not create role", description: errorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Create role
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Create role"
        description="Add a custom role inside the hierarchy. Permissions are set afterwards on the role page."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={submit}>
              Create role
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Key" htmlFor="create-role-key" hint="lowercase_with_underscore" error={errors.key}>
            <Input
              id="create-role-key"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.currentTarget.value }))}
              placeholder="custom_moderator"
              autoComplete="off"
            />
          </Field>
          <Field label="Name" htmlFor="create-role-name" error={errors.name}>
            <Input
              id="create-role-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
              placeholder="Custom Moderator"
            />
          </Field>
          <Field label="Description" htmlFor="create-role-description" error={errors.description}>
            <Input
              id="create-role-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
              placeholder="Optional — what this role is for"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Level"
              htmlFor="create-role-level"
              hint={`0–${maxCreateLevel}`}
              error={errors.level}
            >
              <Input
                id="create-role-level"
                type="number"
                min={0}
                max={maxCreateLevel}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.currentTarget.value }))}
                placeholder="10"
              />
            </Field>
            <Field label="Category" htmlFor="create-role-category" error={errors.category}>
              <Select
                id="create-role-category"
                value={form.category}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setForm((f) => ({
                    ...f,
                    category: v === "administration" || v === "supervision" ? v : "player",
                  }));
                }}
              >
                <option value="player">Player</option>
                <option value="supervision">Supervision</option>
                <option value="administration" disabled={!canCreateAdminRoles}>
                  Administration{canCreateAdminRoles ? "" : " (not allowed for you)"}
                </option>
              </Select>
            </Field>
          </div>
          <Field
            label="Department scope"
            htmlFor="create-role-department"
            hint="empty = global"
            error={errors.departmentId}
          >
            <Select
              id="create-role-department"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.currentTarget.value }))}
            >
              <option value="">Global (all departments)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}
