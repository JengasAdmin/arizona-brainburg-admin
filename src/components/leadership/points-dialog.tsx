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
      setDeltaError("Введите ненулевое целое число.");
      valid = false;
    } else {
      setDeltaError(null);
    }
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) {
      setReasonError("Поле «Причина»: 3–500 символов.");
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
        title: "Баллы обновлены",
        description: `${result.difference > 0 ? "+" : ""}${result.difference} — ${result.oldValue} → ${result.newValue} · ${term.displayName}`,
        variant: "success",
      });
      setDelta("1");
      setReason("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось изменить баллы", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Изменение баллов руководства"
      description={`${term.displayName} — ${term.positionTitle}. Только для активных сроков.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={pending}>
            Применить изменения
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Изменение баллов" htmlFor="points-delta" hint="Отрицательное — списать" error={deltaError}>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => step(-1)}
              disabled={pending}
              aria-label="Уменьшить баллы"
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
              aria-label="Увеличить баллы"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>

        <Field
          label="Причина"
          htmlFor="points-reason"
          hint="3–500 символов"
          error={reasonError}
        >
          <Textarea
            id="points-reason"
            placeholder="Почему меняются баллы?"
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
