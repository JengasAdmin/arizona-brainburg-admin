"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

/** The statuses accepted by `POST /api/users/:id/status`. */
export const USER_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
  { value: "inactive", label: "Inactive" },
] as const;

export type UserStatus = (typeof USER_STATUS_OPTIONS)[number]["value"];

export function StatusDialog({
  userId,
  currentStatus,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  userId: number;
  currentStatus: string;
  /** Rendered as the dialog opener. Omit when the parent controls `open`. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [status, setStatus] = useState<string>(currentStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  const submit = async () => {
    const next = USER_STATUS_OPTIONS.find((option) => option.value === status);
    if (!next) {
      setError("Select a status.");
      return;
    }
    // The API requires a reason (min. 3 characters) for every status change.
    if (reason.trim().length < 3) {
      setError("A reason is required (min. 3 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api(`/api/users/${userId}/status`, {
        method: "POST",
        body: { status: next.value, reason: reason.trim() },
      });
      toast({
        title: "Status updated",
        description: `User #${userId} is now ${next.label.toLowerCase()}.`,
        variant: "success",
      });
      setReason("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not change the status", description: errorMessage(err), variant: "error" });
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
        title="Change status"
        description={`Update the account status of user #${userId}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={loading}>
              Save status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New status" htmlFor="status-dialog-select">
            <Select
              id="status-dialog-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {USER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Reason"
            htmlFor="status-dialog-reason"
            hint="Min. 3 characters"
            error={error}
          >
            <Textarea
              id="status-dialog-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the status is being changed…"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
