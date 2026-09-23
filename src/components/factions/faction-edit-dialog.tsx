"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Pencil } from "lucide-react";

interface EditForm {
  name: string;
  shortName: string;
  description: string;
  status: string;
}

/**
 * Edits the fields accepted by PATCH /api/factions/:id
 * (updateFactionSchema: name, shortName, description, status, …).
 */
export function FactionEditDialog({
  factionId,
  initial,
}: {
  factionId: number;
  initial: EditForm;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [pending, setPending] = useState(false);

  function openDialog() {
    setForm(initial);
    setErrors({});
    setOpen(true);
  }

  function validate(value: EditForm): boolean {
    const next: Partial<Record<keyof EditForm, string>> = {};
    const name = value.name.trim();
    if (name.length < 2 || name.length > 80) next.name = "Name must be 2–80 characters.";
    const shortName = value.shortName.trim();
    if (shortName.length < 2 || shortName.length > 12) {
      next.shortName = "Short name must be 2–12 characters.";
    }
    if (value.description.trim().length > 600) {
      next.description = "Description must be at most 600 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate(form)) return;
    setPending(true);
    try {
      await api(`/api/factions/${factionId}`, {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          shortName: form.shortName.trim(),
          description: form.description.trim() ? form.description.trim() : null,
          status: form.status,
        },
      });
      toast({ title: "Faction updated", description: form.name.trim(), variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not update faction", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog}>
        <Pencil className="h-3.5 w-3.5" /> Edit faction
      </Button>

      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Edit faction"
        description="Name, short name, description and status."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={submit}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="faction-name" error={errors.name ?? null}>
            <Input
              id="faction-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Short name" htmlFor="faction-short" error={errors.shortName ?? null}>
            <Input
              id="faction-short"
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            />
          </Field>
          <Field label="Description" htmlFor="faction-desc" error={errors.description ?? null} hint="optional">
            <Textarea
              id="faction-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={600}
            />
          </Field>
          <Field label="Status" htmlFor="faction-status">
            <Select
              id="faction-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}
