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
      setError("Select a role to assign.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api(`/api/users/${userId}/roles`, { method: "POST", body: { roleKey: chosen.key } });
      toast({
        title: "Role assigned",
        description: `“${chosen.title}” was granted to user #${userId}.`,
        variant: "success",
      });
      setRoleKey("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not assign the role", description: errorMessage(err), variant: "error" });
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
        title="Assign role"
        description={`Grant a role to user #${userId}. Hierarchy rules are enforced server-side.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={loading}
              disabled={available.length === 0}
            >
              Assign role
            </Button>
          </>
        }
      >
        {available.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            No assignable roles available — this user already holds every role you may grant.
          </p>
        ) : (
          <Field label="Role" htmlFor="role-assign-dialog-select" error={error}>
            <Select
              id="role-assign-dialog-select"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              <option value="">Select a role…</option>
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
