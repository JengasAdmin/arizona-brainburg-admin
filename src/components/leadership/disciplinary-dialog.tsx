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
      setError("Поле «Причина»: 3–500 символов.");
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
        title: type === "warning" ? "Предупреждение выдано" : "Выговор вынесен",
        description: `${term.displayName} — ${term.positionTitle}`,
        variant: "success",
      });
      setReason("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Действие не выполнено", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Дисциплинарное взыскание"
      description={`${term.displayName} — ${term.positionTitle}. Только для активных сроков.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Отмена
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={pending}>
            Выдать взыскание
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Тип" htmlFor="disciplinary-type">
          <Select
            id="disciplinary-type"
            value={type}
            onChange={(e) => setType(e.target.value === "reprimand" ? "reprimand" : "warning")}
          >
            <option value="warning">Предупреждение</option>
            <option value="reprimand">Выговор</option>
          </Select>
        </Field>

        <Field label="Причина" htmlFor="disciplinary-reason" hint="3–500 символов" error={error}>
          <Textarea
            id="disciplinary-reason"
            placeholder="Что произошло?"
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
