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
      setError("Поле «Причина»: 3–500 символов.");
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
        title: "Отстранение выполнено",
        description: `${term.displayName} — ${term.positionTitle}`,
        variant: "success",
      });
      setReason("");
      setEndDate("");
      onClose();
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось отстранить", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Отстранение"
      description={`${term.displayName} — ${term.positionTitle}. Историческая запись сохраняется и никогда не удаляется.`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Отмена
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={pending}>
            Отстранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Дата окончания" htmlFor="dismiss-end-date" hint="Необязательно — по умолчанию сегодня">
          <Input
            id="dismiss-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>

        <Field
          label="Причина"
          htmlFor="dismiss-reason"
          hint="3–500 символов"
          error={error}
        >
          <Textarea
            id="dismiss-reason"
            placeholder="Почему это назначение закрывается?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
