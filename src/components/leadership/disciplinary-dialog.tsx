"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";

export interface DisciplinaryTerm {
  id: number;
  displayName: string;
  positionTitle: string;
}

type DisciplinaryType = "warning" | "reprimand";

/**
 * Issues a warning or reprimand: POST /api/leaders/:termId/disciplinary
 * Body: { type: "warning" | "reprimand", reason (3–500) } — the schema accepts
 * no points field; disciplinary actions never carry points.
 */
export function DisciplinaryDialog({
  open,
  onClose,
  term,
}: {
  open: boolean;
  onClose: () => void;
  term: DisciplinaryTerm;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [type, setType] = useState<DisciplinaryType>("warning");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleClose() {
    if (pending) return;
    setType("warning");
    setReason("");
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
      await api(`/api/leaders/${term.id}/disciplinary`, {
        method: "POST",
        body: { type, reason: trimmed },
      });
      toast({
        title: type === "warning" ? "Warning issued" : "Reprimand issued",
        description: `${term.displayName} — ${term.positionTitle}`,
        variant: "success",
      });
      setReason("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Issue disciplinary action"
      description={`${term.displayName} — ${term.positionTitle}. Active terms only.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={pending}>
            Issue action
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type" htmlFor="disciplinary-type">
          <Select
            id="disciplinary-type"
            value={type}
            onChange={(e) => setType(e.target.value === "reprimand" ? "reprimand" : "warning")}
          >
            <option value="warning">Warning</option>
            <option value="reprimand">Reprimand</option>
          </Select>
        </Field>

        <Field label="Reason" htmlFor="disciplinary-reason" hint="3–500 characters" error={error}>
          <Textarea
            id="disciplinary-reason"
            placeholder="What happened?"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
          />
        </Field>
      </div>
    </Dialog>
  );
}
