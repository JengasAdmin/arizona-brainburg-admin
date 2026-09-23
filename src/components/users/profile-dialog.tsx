"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

export interface ProfileDialogValues {
  displayName: string;
  nickname: string | null;
  branch: string | null;
}

/** Edits the core profile fields via `PATCH /api/users/:id` (permission EDIT_PROFILES). */
export function ProfileDialog({
  userId,
  values,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  userId: number;
  values: ProfileDialogValues;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [displayName, setDisplayName] = useState(values.displayName);
  const [nickname, setNickname] = useState(values.nickname ?? "");
  const [branch, setBranch] = useState(values.branch ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const submit = async () => {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 64) {
      setError("Display name must be 2–64 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        body: {
          displayName: name,
          nickname: nickname.trim() === "" ? null : nickname.trim(),
          branch: branch.trim() === "" ? null : branch.trim(),
        },
      });
      toast({ title: "Profile updated", description: `User #${userId} was saved.`, variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not update the profile", description: errorMessage(err), variant: "error" });
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
        title="Edit profile"
        description={`Core profile fields of user #${userId}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={loading}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Display name" htmlFor="profile-dialog-name" error={error}>
            <Input
              id="profile-dialog-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field
            label="In-game nickname"
            htmlFor="profile-dialog-nickname"
            hint="Optional"
          >
            <Input
              id="profile-dialog-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Branch" htmlFor="profile-dialog-branch" hint="Optional">
            <Input
              id="profile-dialog-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="e.g. Government / Law Enforcement"
              autoComplete="off"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
