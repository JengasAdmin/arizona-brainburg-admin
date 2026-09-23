"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";

export interface DismissableTerm {
  id: number;
  displayName: string;
  positionTitle: string;
}

/**
 * Closes an active term: POST /api/leaders/:termId/dismiss
 * Body: { reason (required, 3–500), dismissedAt? (YYYY-MM-DD, defaults to today) }.
 */
export function DismissDialog({
  open,
  onClose,
  term,
}: {
  open: boolean;
  onClose: () => void;
  term: DismissableTerm;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [reason, setReason] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleClose() {
    if (pending) return;
    setReason("");
    setEndDate("");
    setError(null);
    onClose();
  }

  async function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) {
      setError("Reason must be 3–500 characters.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api(`/api/leaders/${term.id}/dismiss`, {
        method: "POST",
        body: {
          reason: trimmed,
          ...(endDate ? { dismissedAt: endDate } : {}),
        },
      });
      toast({
        title: "Term dismissed",
        description: `${term.displayName} — ${term.positionTitle}`,
        variant: "success",
      });
      setReason("");
      setEndDate("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Dismissal failed", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Dismiss term"
      description={`${term.displayName} — ${term.positionTitle}. The historical record is kept and never deleted.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={pending}>
            Dismiss term
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="End date" htmlFor="dismiss-end-date" hint="Optional — defaults to today">
          <Input
            id="dismiss-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>

        <Field
          label="Reason"
          htmlFor="dismiss-reason"
          hint="3–500 characters"
          error={error}
        >
          <Textarea
            id="dismiss-reason"
            placeholder="Why is this term being closed?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
