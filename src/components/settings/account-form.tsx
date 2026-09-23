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
    return "Display name must be 2–64 characters.";
  }
  if (form.nickname.trim().length > 64) return "Nickname must be at most 64 characters.";
  if (form.branch.trim().length > 120) return "Branch must be at most 120 characters.";
  const gameId = form.gameId.trim();
  if (gameId && !/^[0-9A-Za-z_-]{1,32}$/.test(gameId)) {
    return "Game ID must be 1–32 letters, digits, underscores or hyphens.";
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
      toast({ title: "Profile updated.", variant: "success" });
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
        <Pencil className="h-3.5 w-3.5" /> Edit profile
      </Button>
      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Edit profile"
        description="Changing your Game ID always resets its verification."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={() => void submit()}>
              Save changes
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
          <Field label="Display name" htmlFor="profile-display-name" error={error}>
            <Input
              id="profile-display-name"
              required
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            />
          </Field>
          <Field label="Nickname" htmlFor="profile-nickname">
            <Input
              id="profile-nickname"
              value={form.nickname}
              onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            />
          </Field>
          <Field label="Branch" htmlFor="profile-branch">
            <Input
              id="profile-branch"
              value={form.branch}
              onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
            />
          </Field>
          <Field label="Game ID" htmlFor="profile-game-id" hint="Letters, digits, _ or - · max 32">
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
