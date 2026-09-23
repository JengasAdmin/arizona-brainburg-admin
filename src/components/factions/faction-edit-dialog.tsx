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
    if (name.length < 2 || name.length > 80) next.name = "Поле «Название»: 2–80 символов.";
    const shortName = value.shortName.trim();
    if (shortName.length < 2 || shortName.length > 12) {
      next.shortName = "Поле «Краткое название»: 2–12 символов.";
    }
    if (value.description.trim().length > 600) {
      next.description = "Поле «Описание»: не более 600 символов.";
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
      toast({ title: "Фракция обновлена", description: form.name.trim(), variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось обновить фракцию", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog}>
        <Pencil className="h-3.5 w-3.5" /> Изменить фракцию
      </Button>

      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Изменение фракции"
        description="Название, краткое название, описание и статус."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button variant="primary" loading={pending} onClick={submit}>
              Сохранить изменения
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Название" htmlFor="faction-name" error={errors.name ?? null}>
            <Input
              id="faction-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Краткое название" htmlFor="faction-short" error={errors.shortName ?? null}>
            <Input
              id="faction-short"
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            />
          </Field>
          <Field label="Описание" htmlFor="faction-desc" error={errors.description ?? null} hint="необязательно">
            <Textarea
              id="faction-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={600}
            />
          </Field>
          <Field label="Статус" htmlFor="faction-status">
            <Select
              id="faction-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Активна</option>
              <option value="inactive">Неактивна</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </>
  );
}
