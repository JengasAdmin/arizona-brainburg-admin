"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

/** Changing the Game ID goes through the profile endpoint (permission EDIT_PROFILES). */
export function GameIdDialog({
  userId,
  currentGameId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  userId: number;
  currentGameId: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [value, setValue] = useState<string>(currentGameId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const submit = async () => {
    const trimmed = value.trim();
    // Mirrors the server-side schema: 1–32 alphanumeric characters, "_" or "-".
    if (trimmed && !/^[0-9A-Za-z_-]{1,32}$/.test(trimmed)) {
      setError("Укажите 1–32 символа: буквы, цифры, «_» или «-».");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        body: { gameId: trimmed === "" ? null : trimmed },
      });
      toast({
        title: "Game ID обновлён",
        description: trimmed === "" ? "Game ID очищен." : `Новый Game ID: ${trimmed}.`,
        variant: "success",
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось обновить Game ID", description: errorMessage(err), variant: "error" });
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
        title="Изменить Game ID"
        description={`Game ID пользователя #${userId} в Arizona RP.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button variant="primary" onClick={submit} loading={loading}>
              Сохранить Game ID
            </Button>
          </>
        }
      >
        <Field
          label="Game ID"
          htmlFor="game-id-dialog-input"
          hint="Оставьте пустым, чтобы очистить"
          error={error}
        >
          <Input
            id="game-id-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="напр. 12345"
            autoComplete="off"
          />
        </Field>
        <p className="mt-2 text-[11px] text-neutral-600">
          Смена Game ID сбрасывает его подтверждение — его нужно пройти заново.
        </p>
      </Dialog>
    </>
  );
}
