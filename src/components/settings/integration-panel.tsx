"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export interface IntegrationKeyItem {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface IntegrationStatusInfo {
  status: string;
  enabled: boolean;
  activeKeys: number;
  eventsReceived: number;
  apiUrl: string | null;
  note: string;
}

function statusTone(status: string): "ok" | "warn" | "danger" {
  if (status === "Подключено") return "ok";
  if (status === "Отключено") return "danger";
  return "warn";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-2.5 last:border-b-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-neutral-200">{children}</span>
    </div>
  );
}

/**
 * Integration overview + API keys management.
 *  - status      → GET  /api/integration
 *  - keys list   → GET  /api/integration/keys
 *  - create      → POST /api/integration/keys   (plaintext key returned once)
 *  - revoke      → DELETE /api/integration/keys/:id
 * Static documentation of the game-bot endpoints (real routes under
 * src/app/api/integration/game/*) is shown as method + path only.
 */
export function IntegrationPanel({
  info,
  keys,
  canManage,
}: {
  info: IntegrationStatusInfo;
  keys: IntegrationKeyItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<{ id: number; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreated(null);
    setName("");
    setNameError(null);
  };

  const createKey = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setNameError("Поле «Название ключа»: 2–60 символов.");
      return;
    }
    setNameError(null);
    setCreating(true);
    try {
      const res = await api<{ id: number; key: string; name: string; scopes: string[] }>(
        "/api/integration/keys",
        { method: "POST", body: { name: trimmed } },
      );
      setCreated({ key: res.key, name: res.name });
      router.refresh();
    } catch (err) {
      setNameError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      toast({ title: "Ключ скопирован в буфер обмена.", variant: "success" });
    } catch {
      toast({
        title: "Не удалось скопировать.",
        description: "Выделите текст в поле и скопируйте его вручную.",
        variant: "error",
      });
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api(`/api/integration/keys/${revokeTarget.id}`, { method: "DELETE" });
      toast({ title: `Ключ «${revokeTarget.name}» отозван.`, variant: "success" });
      setRevokeTarget(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось отозвать ключ.", description: errorMessage(err), variant: "error" });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Статус интеграции" description={info.note} />
        <CardBody>
          <Row label="Статус">
            <Badge tone={statusTone(info.status)} dot>
              {info.status}
            </Badge>
          </Row>
          <Row label="Включено">{info.enabled ? "Да" : "Нет"}</Row>
          <Row label="Базовый URL API">
            <span className="font-mono text-[12px]">{info.apiUrl ?? "—"}</span>
          </Row>
          <Row label="Активные ключи">{String(info.activeKeys)}</Row>
          <Row label="Получено событий">{String(info.eventsReceived)}</Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Ключи API"
          description="Хранится только хеш SHA-256 каждого ключа — открытый ключ показывается один раз при создании."
          actions={
            canManage ? (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Создать ключ
              </Button>
            ) : undefined
          }
        />
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-8 w-8" />}
            title="Ключи API ещё не созданы"
            description="Создайте ключ, чтобы игровой бот мог проходить аутентификацию в API интеграции."
          />
        ) : (
          <Table className="min-w-[760px]">
            <THead>
              <TR>
                <TH>Название</TH>
                <TH>Префикс</TH>
                <TH>Зоны ответственности</TH>
                <TH>Статус</TH>
                <TH>Создан</TH>
                <TH>Последнее использование</TH>
                {canManage ? <TH align="right">Действия</TH> : null}
              </TR>
            </THead>
            <TBody>
              {keys.map((key) => (
                <TR key={key.id}>
                  <TD className="text-neutral-200">{key.name}</TD>
                  <TD className="font-mono text-[12px] text-neutral-400">{key.keyPrefix}</TD>
                  <TD>
                    <span className="flex flex-wrap gap-1">
                      {key.scopes.length === 0 ? (
                        <span className="text-[11px] text-neutral-600">—</span>
                      ) : (
                        key.scopes.map((scope) => (
                          <Badge key={scope} tone="neutral">
                            {scope}
                          </Badge>
                        ))
                      )}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={key.status} label={key.status === "active" ? "Активен" : "Отключено"} />
                  </TD>
                  <TD className="whitespace-nowrap text-neutral-400">{formatDateTime(key.createdAt)}</TD>
                  <TD className="whitespace-nowrap text-neutral-500">{formatDateTime(key.lastUsedAt)}</TD>
                  {canManage ? (
                    <TD align="right">
                      {key.status === "active" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRevokeTarget({ id: key.id, name: key.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Отозвать
                        </Button>
                      ) : (
                        <span className="text-[11px] text-neutral-600">—</span>
                      )}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Эндпоинты игрового API"
          description="Маршруты с Bearer-аутентификацией для игрового бота (Authorization: Bearer <key>)."
        />
        <CardBody>
          <div className="space-y-2">
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <code className="font-mono text-[12px] text-neutral-200">
                POST /api/integration/game/events
              </code>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Приём игровых событий — требуется включённая интеграция и активный ключ.
              </p>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <code className="font-mono text-[12px] text-neutral-200">
                GET /api/integration/game/players
              </code>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Список игроков: Game ID, никнейм, фракция и ранг (лимит 500).
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Create key dialog — plaintext key is shown exactly once. */}
      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title={created ? "Ключ API создан" : "Создание ключа API"}
        description={
          created
            ? undefined
            : "Ключ будет создан с зонами ответственности по умолчанию: game:read, activity:write."
        }
        footer={
          created ? (
            <Button variant="primary" onClick={closeCreate} disabled={creating}>
              Готово
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCreate} disabled={creating}>
                Отмена
              </Button>
              <Button variant="primary" loading={creating} onClick={() => void createKey()}>
                Создать ключ
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="space-y-3">
            <p className="rounded-md border border-[#3d3316] bg-[#211c0d] px-3 py-2 text-xs text-warn">
              Сохраните этот ключ сейчас — он больше не будет показан.
            </p>
            <pre className="overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-[12px] text-neutral-200">
              {created.key}
            </pre>
            <Button variant="outline" size="sm" onClick={() => void copyKey()}>
              <Copy className="h-3.5 w-3.5" /> Копировать
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void createKey();
            }}
          >
            <Field label="Название ключа" htmlFor="integration-key-name" error={nameError}>
              <Input
                id="integration-key-name"
                required
                minLength={2}
                maxLength={60}
                placeholder="например, game-bot-prod"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={revokeTarget !== null}
        loading={revoking}
        request={
          revokeTarget
            ? {
                title: "Отозвать ключ API?",
                description: "Ключ перестанет работать немедленно. Это действие нельзя отменить.",
                fields: [{ label: "Ключ", value: revokeTarget.name }],
                confirmLabel: "Отозвать ключ",
                danger: true,
              }
            : null
        }
        onConfirm={() => void revoke()}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
