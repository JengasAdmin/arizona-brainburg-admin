"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";

export interface PointsTerm {
  id: number;
  displayName: string;
  positionTitle: string;
}

interface PointsResult {
  termId: number;
  oldValue: number;
  newValue: number;
  difference: number;
}

/**
 * Adjusts leadership points: POST /api/leaders/:termId/points
 * Body: { delta (non-zero integer), reason (3–500) } — there is no `type` field.
 */
export function PointsDialog({
  open,
  onClose,
  term,
}: {
  open: boolean;
  onClose: () => void;
  term: PointsTerm;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  const [deltaError, setDeltaError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function step(by: number) {
    const current = Number(delta);
    const base = Number.isInteger(current) ? current : 0;
    setDelta(String(base + by));
    setDeltaError(null);
  }

  function handleClose() {
    if (pending) return;
    setDelta("1");
    setReason("");
    setDeltaError(null);
    setReasonError(null);
    onClose();
  }

  async function submit() {
    const parsed = Number(delta);
    let valid = true;
    if (!Number.isInteger(parsed) || parsed === 0) {
      setDeltaError("Enter a non-zero whole number.");
      valid = false;
    } else {
      setDeltaError(null);
    }
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) {
      setReasonError("Reason must be 3–500 characters.");
      valid = false;
    } else {
      setReasonError(null);
    }
    if (!valid) return;

    setPending(true);
    try {
      const result = await api<PointsResult>(`/api/leaders/${term.id}/points`, {
        method: "POST",
        body: { delta: parsed, reason: trimmed },
      });
      toast({
        title: "Points updated",
        description: `${result.difference > 0 ? "+" : ""}${result.difference} — ${result.oldValue} → ${result.newValue} · ${term.displayName}`,
        variant: "success",
      });
      setDelta("1");
      setReason("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Points adjustment failed", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Adjust leadership points"
      description={`${term.displayName} — ${term.positionTitle}. Active terms only.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={pending}>
            Apply change
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Points delta" htmlFor="points-delta" hint="Negative to remove" error={deltaError}>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => step(-1)}
              disabled={pending}
              aria-label="Decrease points"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id="points-delta"
              type="number"
              step={1}
              className="w-24 text-center"
              value={delta}
              onChange={(e) => {
                setDelta(e.target.value);
                setDeltaError(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => step(1)}
              disabled={pending}
              aria-label="Increase points"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>

        <Field
          label="Reason"
          htmlFor="points-reason"
          hint="3–500 characters"
          error={reasonError}
        >
          <Textarea
            id="points-reason"
            placeholder="Why are the points changing?"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
            }}
          />
        </Field>
      </div>
    </Dialog>
  );
}
