"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

export interface OwnProfile {
  id: number;
  displayName: string;
  nickname: string | null;
  branch: string | null;
  gameId: string | null;
}

interface FormState {
  displayName: string;
  nickname: string;
  branch: string;
  gameId: string;
}

/** Mirrors the server zod schema of PATCH /api/me. */
function validate(form: FormState): string | null {
  const displayName = form.displayName.trim();
  if (displayName.length < 2 || displayName.length > 64) {
    return "Поле «Отображаемое имя»: 2–64 символов.";
  }
  if (form.nickname.trim().length > 64) return "Поле «Никнейм»: не более 64 символов.";
  if (form.branch.trim().length > 120) return "Поле «Направление»: не более 120 символов.";
  const gameId = form.gameId.trim();
  if (gameId && !/^[0-9A-Za-z_-]{1,32}$/.test(gameId)) {
    return "Game ID: 1–32 символа — буквы, цифры, «_» или «-».";
  }
  return null;
}

/**
 * Edit-profile dialog for the signed-in user — PATCH /api/me
 * (displayName, nickname, branch, gameId; nullable fields send null).
 */
export function AccountForm({ profile }: { profile: OwnProfile }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    displayName: profile.displayName,
    nickname: profile.nickname ?? "",
    branch: profile.branch ?? "",
    gameId: profile.gameId ?? "",
  });

  const openEdit = () => {
    setForm({
      displayName: profile.displayName,
      nickname: profile.nickname ?? "",
      branch: profile.branch ?? "",
      gameId: profile.gameId ?? "",
    });
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: {
          displayName: form.displayName.trim(),
          nickname: form.nickname.trim() || null,
          branch: form.branch.trim() || null,
          gameId: form.gameId.trim() || null,
        },
      });
      toast({ title: "Профиль обновлён.", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={openEdit}>
        <Pencil className="h-3.5 w-3.5" /> Редактировать профиль
      </Button>
      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Редактирование профиля"
        description="Изменение Game ID всегда сбрасывает его подтверждение."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button variant="primary" loading={pending} onClick={() => void submit()}>
              Сохранить изменения
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Отображаемое имя" htmlFor="profile-display-name" error={error}>
            <Input
              id="profile-display-name"
              required
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            />
          </Field>
          <Field label="Никнейм" htmlFor="profile-nickname">
            <Input
              id="profile-nickname"
              value={form.nickname}
              onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            />
          </Field>
          <Field label="Направление" htmlFor="profile-branch">
            <Input
              id="profile-branch"
              value={form.branch}
              onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
            />
          </Field>
          <Field label="Game ID" htmlFor="profile-game-id" hint="Буквы, цифры, _ или - · макс. 32">
            <Input
              id="profile-game-id"
              value={form.gameId}
              onChange={(e) => setForm((prev) => ({ ...prev, gameId: e.target.value }))}
            />
          </Field>
        </form>
      </Dialog>
    </>
  );
}
