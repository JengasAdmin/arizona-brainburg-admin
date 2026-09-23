"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ClipboardPlus } from "lucide-react";

interface Form {
  userId: string;
  action: string;
  description: string;
  occurredAt: string;
  factionId: string;
}

const EMPTY: Form = { userId: "", action: "", description: "", occurredAt: "", factionId: "" };

/**
 * Records a manual game activity entry via POST /api/activity
 * (createActivitySchema: userId > 0, action 2–60, description 3–500,
 * optional occurredAt date, optional factionId).
 */
export function LogActivityDialog({ factions }: { factions: { id: number; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [pending, setPending] = useState(false);

  function validate(value: Form): boolean {
    const next: Partial<Record<keyof Form, string>> = {};
    const userId = Number(value.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      next.userId = "Введите корректный ID пользователя.";
    }
    const action = value.action.trim();
    if (action.length < 2 || action.length > 60) {
      next.action = "Поле «Действие»: 2–60 символов.";
    }
    const description = value.description.trim();
    if (description.length < 3 || description.length > 500) {
      next.description = "Поле «Описание»: 3–500 символов.";
    }
    if (value.occurredAt) {
      const parsed = new Date(value.occurredAt);
      if (Number.isNaN(parsed.getTime())) next.occurredAt = "Некорректные дата/время.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate(form)) return;
    setPending(true);
    try {
      await api("/api/activity", {
        method: "POST",
        body: {
          userId: Number(form.userId),
          action: form.action.trim(),
          description: form.description.trim(),
          ...(form.occurredAt
            ? { occurredAt: new Date(form.occurredAt).toISOString() }
            : {}),
          ...(form.factionId ? { factionId: Number(form.factionId) } : {}),
        },
      });
      toast({
        title: "Активность записана",
        description: `${form.action.trim()} — пользователь #${form.userId}`,
        variant: "success",
      });
      setOpen(false);
      setForm(EMPTY);
      setErrors({});
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось записать активность", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <ClipboardPlus className="h-3.5 w-3.5" /> Записать активность
      </Button>

      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Запись игровой активности"
        description="Ручная запись о сессии — пока игровой API не подключён."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
            <Button variant="primary" loading={pending} onClick={submit}>
              Записать активность
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID пользователя" htmlFor="act-user" error={errors.userId ?? null}>
              <Input
                id="act-user"
                type="number"
                min={1}
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="124"
              />
            </Field>
            <Field label="Фракция" htmlFor="act-faction" hint="необязательно">
              <Select
                id="act-faction"
                value={form.factionId}
                onChange={(e) => setForm((f) => ({ ...f, factionId: e.target.value }))}
              >
                <option value="">— нет —</option>
                {factions.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Действие" htmlFor="act-action" error={errors.action ?? null} hint="2–60 символов">
            <Input
              id="act-action"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              placeholder="Патрульная смена"
            />
          </Field>
          <Field label="Описание" htmlFor="act-desc" error={errors.description ?? null}>
            <Textarea
              id="act-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={500}
              placeholder="Отработал двухчасовую патрульную смену в центре Лос-Сантоса."
            />
          </Field>
          <Field label="Время события" htmlFor="act-when" error={errors.occurredAt ?? null} hint="необязательно — по умолчанию сейчас">
            <Input
              id="act-when"
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
