"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

export interface AssignableRole {
  key: string;
  title: string;
  scope: string;
}

export function RoleAssignDialog({
  userId,
  roles,
  assignedKeys = [],
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  userId: number;
  /** Roles the current actor is allowed to assign (computed server-side). */
  roles: AssignableRole[];
  /** Keys the target user already has — they are filtered out of the select. */
  assignedKeys?: string[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [roleKey, setRoleKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const available = roles.filter((role) => !assignedKeys.includes(role.key));

  const submit = async () => {
    const chosen = available.find((role) => role.key === roleKey);
    if (!chosen) {
      setError("Выберите роль для назначения.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api(`/api/users/${userId}/roles`, { method: "POST", body: { roleKey: chosen.key } });
      toast({
        title: "Роль назначена",
        description: `«${chosen.title}» выдана пользователю #${userId}.`,
        variant: "success",
      });
      setRoleKey("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось назначить роль", description: errorMessage(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span className="inline-flex" onClick={() => setOpen(true)}>
          {trigger}
        </span>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Назначить роль"
        description={`Выдача роли пользователю #${userId}. Правила иерархии проверяются на сервере.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={loading}
              disabled={available.length === 0}
            >
              Назначить роль
            </Button>
          </>
        }
      >
        {available.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            Нет доступных ролей для назначения — у этого пользователя уже есть все роли, которые
            вы можете выдать.
          </p>
        ) : (
          <Field label="Роль" htmlFor="role-assign-dialog-select" error={error}>
            <Select
              id="role-assign-dialog-select"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              <option value="">Выберите роль…</option>
              {available.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.title} — {role.scope}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Dialog>
    </>
  );
}
