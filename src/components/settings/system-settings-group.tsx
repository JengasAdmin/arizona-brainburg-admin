"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";

export interface SystemSettingItem {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}

/** Staged value for one setting row, derived from the type of the current value. */
type Draft =
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; text: string }
  | { kind: "text"; text: string }
  | { kind: "json"; text: string };

function draftOf(value: unknown): Draft {
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number") return { kind: "number", text: String(value) };
  if (typeof value === "string") return { kind: "text", text: value };
  return { kind: "json", text: JSON.stringify(value, null, 2) };
}

function initialDrafts(items: SystemSettingItem[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const item of items) drafts[item.key] = draftOf(item.value);
  return drafts;
}

function isDirty(item: SystemSettingItem, draft: Draft | undefined): boolean {
  if (!draft) return false;
  if (draft.kind === "boolean") return draft.value !== item.value;
  if (draft.kind === "text") return draft.text !== item.value;
  if (draft.kind === "number") {
    const n = Number(draft.text);
    return Number.isFinite(n) ? n !== item.value : true;
  }
  try {
    return JSON.stringify(JSON.parse(draft.text)) !== JSON.stringify(item.value);
  } catch {
    return true;
  }
}

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

function parseDraft(draft: Draft | undefined): ParseResult {
  if (!draft) return { ok: false, error: "Не указано значение." };
  if (draft.kind === "boolean") return { ok: true, value: draft.value };
  const raw = draft.text.trim();
  if (draft.kind === "text") return { ok: true, value: draft.text };
  if (draft.kind === "number") {
    if (!raw) return { ok: false, error: "Введите число." };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: "Введите корректное число." };
    return { ok: true, value: n };
  }
  try {
    return { ok: true, value: JSON.parse(draft.text) };
  } catch {
    return { ok: false, error: "Некорректный JSON." };
  }
}

function BooleanToggle({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-600",
        checked ? "border-transparent bg-white" : "border-line2 bg-raised",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
          checked ? "left-[18px] bg-black" : "left-0.5 bg-neutral-500",
        )}
      />
    </button>
  );
}

/**
 * System settings editor — one row per catalog entry with an inline control
 * typed by the current value, a per-row Save (PATCH /api/settings/:key with
 * { value }). The API exposes no reset endpoint, so no reset affordance exists.
 */
export function SystemSettingsGroup({ items }: { items: SystemSettingItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => initialDrafts(items));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const setDraft = (key: string, draft: Draft) => {
    setDrafts((prev) => ({ ...prev, [key]: draft }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
  };

  const save = async (item: SystemSettingItem) => {
    const parsed = parseDraft(drafts[item.key]);
    if (!parsed.ok) {
      setErrors((prev) => ({ ...prev, [item.key]: parsed.error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [item.key]: null }));
    setSavingKey(item.key);
    try {
      await api(`/api/settings/${item.key}`, { method: "PATCH", body: { value: parsed.value } });
      toast({ title: `Настройка «${item.key}» сохранена.`, variant: "success" });
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      setErrors((prev) => ({ ...prev, [item.key]: message }));
      toast({ title: "Не удалось сохранить настройку.", description: message, variant: "error" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Системные настройки"
        description="Глобальные переключатели платформы. Каждое изменение записывается в журнал аудита."
      />
      <CardBody padded={false}>
        <div className="divide-y divide-line">
          {items.map((item) => {
            const draft = drafts[item.key];
            const dirty = isDirty(item, draft);
            const error = errors[item.key] ?? null;
            const busy = savingKey === item.key;

            return (
              <div key={item.key} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] text-neutral-200">{item.key}</div>
                    {item.description ? (
                      <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">{item.description}</p>
                    ) : null}
                    <div className="mt-0.5 text-[11px] text-neutral-600">
                      Обновлено {formatDateTime(item.updatedAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {draft?.kind === "boolean" ? (
                      <BooleanToggle
                        checked={draft.value}
                        label={item.key}
                        disabled={savingKey !== null}
                        onToggle={() => setDraft(item.key, { kind: "boolean", value: !draft.value })}
                      />
                    ) : draft?.kind === "number" ? (
                      <Input
                        aria-label={item.key}
                        className="w-36"
                        inputMode="decimal"
                        value={draft.text}
                        disabled={savingKey !== null}
                        onChange={(e) => setDraft(item.key, { kind: "number", text: e.target.value })}
                      />
                    ) : draft?.kind === "text" ? (
                      <Input
                        aria-label={item.key}
                        className="w-64"
                        value={draft.text}
                        disabled={savingKey !== null}
                        onChange={(e) => setDraft(item.key, { kind: "text", text: e.target.value })}
                      />
                    ) : draft ? (
                      <Textarea
                        aria-label={item.key}
                        className="w-72 font-mono text-xs"
                        rows={3}
                        value={draft.text}
                        disabled={savingKey !== null}
                        onChange={(e) => setDraft(item.key, { kind: "json", text: e.target.value })}
                      />
                    ) : null}

                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!dirty}
                      loading={busy}
                      onClick={() => void save(item)}
                    >
                      <Save className="h-3.5 w-3.5" /> Сохранить
                    </Button>
                  </div>
                </div>
                {error ? <p className="mt-1.5 text-[11px] text-danger">{error}</p> : null}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
