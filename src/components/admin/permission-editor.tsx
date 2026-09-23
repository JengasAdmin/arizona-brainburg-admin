"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Save, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { PERMISSIONS, type PermissionDefinition } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

interface PermissionEditorProps {
  roleKey: string;
  roleName: string;
  /** The full permission set currently stored for this role (service: listRolesWithPermissions). */
  initialGrants: string[];
  /** Catalog defaults for this role (inherent permissions — always included). */
  basePermissions: string[];
  /** Permission keys this actor may grant, computed server-side with canGrantPermission(). */
  grantable: string[];
  /** Server-side canAssignRole(actor, role).allowed */
  canAssign: boolean;
  /** Whether the acting user holds the Founder role (server enforces its bypass too). */
  isFounder: boolean;
  /** Server-side flag: role is in the catalog, not the Founder role and every base key is grantable. */
  canResetGrants: boolean;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

interface PermissionGroup {
  group: PermissionDefinition["group"];
  items: PermissionDefinition[];
}

export function PermissionEditor({
  roleKey,
  roleName,
  initialGrants,
  basePermissions,
  grantable,
  canAssign,
  isFounder,
  canResetGrants,
}: PermissionEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const baseSet = useMemo(() => new Set(basePermissions), [basePermissions]);
  const grantableSet = useMemo(() => new Set(grantable), [grantable]);

  // Editor state = base ∪ stored grants (the API takes the FULL replacement set).
  const initialList = useMemo(() => {
    const set = new Set<string>([...basePermissions, ...initialGrants]);
    return [...set].sort();
  }, [basePermissions, initialGrants]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialList));
  // Re-sync whenever the server hands down fresh props (after save/reset + router.refresh()).
  useEffect(() => {
    setSelected(new Set(initialList));
  }, [initialList]);

  const grouped = useMemo<PermissionGroup[]>(() => {
    const map = new Map<PermissionDefinition["group"], PermissionDefinition[]>();
    for (const perm of PERMISSIONS) {
      const list = map.get(perm.group);
      if (list) list.push(perm);
      else map.set(perm.group, [perm]);
    }
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  }, []);

  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Curator-type actors can open the role but may not change any permission set.
  const editable = canAssign && (isFounder || grantable.length > 0);
  const readOnlyReason = !canAssign
    ? "Вашему аккаунту нельзя назначать или изменять эту роль (решение движка RBAC)."
    : "У вас нет права MANAGE_PERMISSIONS, поэтому изменять наборы прав нельзя.";

  const dirtyList = useMemo(() => {
    const current = [...selected].sort();
    if (current.length !== initialList.length) return current;
    return current.some((k, i) => k !== initialList[i]) ? current : null;
  }, [selected, initialList]);
  const dirty = dirtyList !== null;

  const hasCustomGrants = !sameSet(initialGrants, basePermissions);
  const showDangerZone = editable && canResetGrants && hasCustomGrants;

  const toggle = (key: string) => {
    if (!editable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api<{ roleKey: string; permissions: string[] }>(
        `/api/admin/roles/${roleKey}/permissions`,
        { method: "PUT", body: { permissionKeys: [...selected].sort() } },
      );
      const next = new Set<string>([...basePermissions, ...res.permissions]);
      setSelected(next);
      toast({
        title: "Права сохранены",
        description: `У роли «${roleName}» теперь ${next.size} прав.`,
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось сохранить права", description: errorMessage(err), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const resetGrants = async () => {
    setResetting(true);
    try {
      const res = await api<{ roleKey: string; permissions: string[] }>(
        `/api/admin/roles/${roleKey}/permissions`,
        { method: "PUT", body: { permissionKeys: basePermissions } },
      );
      setSelected(new Set<string>([...basePermissions, ...res.permissions]));
      toast({
        title: "Пользовательские права сброшены",
        description: `Восстановлены ${basePermissions.length} прав каталога роли «${roleName}».`,
        variant: "success",
      });
      setResetOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось сбросить права", description: errorMessage(err), variant: "error" });
    } finally {
      setResetting(false);
    }
  };

  const titleFor = (perm: PermissionDefinition, isBase: boolean, canToggle: boolean): string | undefined => {
    if (canToggle) return undefined;
    if (isBase) return "Входит в роль по умолчанию — всегда включено.";
    if (!grantableSet.has(perm.key)) return "Вы не можете выдать это право";
    if (!canAssign) return "Вы не можете изменять эту роль.";
    return readOnlyReason;
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Редактор прав"
          description={
            editable
              ? "Выдавайте или отзывайте права этой роли. Базовые права входят в роль по умолчанию и всегда включены."
              : readOnlyReason
          }
        />

        {!editable ? (
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-start gap-2.5 rounded-md border border-line bg-panel px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <div>
                <p className="text-[13px] text-neutral-200">Только для просмотра — изменять права этой роли нельзя.</p>
                <p className="mt-0.5 text-xs text-neutral-600">{readOnlyReason}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          {grouped.map((group) => {
            const groupSelected = group.items.filter((item) => selected.has(item.key)).length;
            return (
              <div key={group.group} className="border-b border-line last:border-b-0">
                <div className="flex items-center justify-between gap-2 bg-surface px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {group.group}
                  </span>
                  <span className="text-[11px] text-neutral-600">
                    {groupSelected}/{group.items.length}
                  </span>
                </div>
                <div className="divide-y divide-line/70">
                  {group.items.map((perm) => {
                    const isBase = baseSet.has(perm.key);
                    const checked = selected.has(perm.key);
                    const canToggle = editable && !isBase && grantableSet.has(perm.key);
                    const locked = !canToggle;
                    return (
                      <div key={perm.key} className="flex items-start gap-3 px-4 py-2.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={checked}
                          aria-label={perm.name}
                          disabled={!canToggle}
                          title={titleFor(perm, isBase, canToggle)}
                          onClick={() => toggle(perm.key)}
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked
                              ? "border-white bg-white text-black"
                              : "border-line2 bg-panel text-transparent",
                            canToggle && "hover:border-neutral-500",
                            !canToggle && "cursor-not-allowed opacity-70",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] text-neutral-200">{perm.name}</span>
                            {isBase ? <Badge tone="info">база</Badge> : null}
                            {perm.critical ? <Badge tone="warn">критично</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-600">{perm.description}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-neutral-700">{perm.key}</p>
                        </div>
                        {locked ? (
                          <span title={titleFor(perm, isBase, canToggle)} className="mt-1 text-neutral-700">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {editable ? (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t border-line bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="text-neutral-300">{selected.size} выбрано</span>
              <span className="text-neutral-600">из {PERMISSIONS.length}</span>
              {dirty ? <Badge tone="warn">Несохранённые изменения</Badge> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={() => setSelected(new Set(initialList))}>
                Сбросить
              </Button>
              <Button size="sm" variant="primary" loading={saving} disabled={!dirty} onClick={save}>
                <Save className="h-3.5 w-3.5" /> Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {showDangerZone ? (
        <Card className="mt-4">
          <CardHeader title="Опасная зона" description="Деструктивные действия с этой ролью, записываемые в аудит." />
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-neutral-200">Сбросить пользовательские права</p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  Будет отброшен пользовательский набор из {initialGrants.length} прав и восстановлены
                  {" "}значения каталога по умолчанию ({basePermissions.length}).
                  {" "}Действие записывается в журнал аудита.
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setResetOpen(true)}>
                <TriangleAlert className="h-3.5 w-3.5" /> Сбросить права
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <ConfirmDialog
        open={resetOpen}
        loading={resetting}
        request={
          resetOpen
            ? {
                title: "Сбросить пользовательские права?",
                description: `Восстановить набор прав по умолчанию из каталога для роли «${roleName}».`,
                fields: [
                  { label: "Роль", value: roleName },
                  { label: "Пользовательский набор", value: `${initialGrants.length} прав` },
                  { label: "После сброса", value: `${basePermissions.length} прав` },
                ],
                confirmLabel: "Сбросить права",
                danger: true,
              }
            : null
        }
        onConfirm={resetGrants}
        onCancel={() => setResetOpen(false)}
      />
    </>
  );
}
