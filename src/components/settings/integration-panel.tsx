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
  if (status === "Connected") return "ok";
  if (status === "Disabled") return "danger";
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
      setNameError("Name must be 2–60 characters.");
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
      toast({ title: "Key copied to clipboard.", variant: "success" });
    } catch {
      toast({
        title: "Copy failed.",
        description: "Select the text in the box and copy it manually.",
        variant: "error",
      });
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api(`/api/integration/keys/${revokeTarget.id}`, { method: "DELETE" });
      toast({ title: `Key “${revokeTarget.name}” revoked.`, variant: "success" });
      setRevokeTarget(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not revoke the key.", description: errorMessage(err), variant: "error" });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Integration status" description={info.note} />
        <CardBody>
          <Row label="Status">
            <Badge tone={statusTone(info.status)} dot>
              {info.status}
            </Badge>
          </Row>
          <Row label="Enabled">{info.enabled ? "Yes" : "No"}</Row>
          <Row label="API base URL">
            <span className="font-mono text-[12px]">{info.apiUrl ?? "—"}</span>
          </Row>
          <Row label="Active keys">{String(info.activeKeys)}</Row>
          <Row label="Events received">{String(info.eventsReceived)}</Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="API keys"
          description="Only a SHA-256 hash of each key is stored — the plaintext is shown once at creation."
          actions={
            canManage ? (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Create key
              </Button>
            ) : undefined
          }
        />
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-8 w-8" />}
            title="No API keys provisioned yet"
            description="Create a key so the game bot can authenticate against the integration API."
          />
        ) : (
          <Table className="min-w-[760px]">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Prefix</TH>
                <TH>Scopes</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH>Last used</TH>
                {canManage ? <TH align="right">Actions</TH> : null}
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
                    <StatusBadge status={key.status} label={key.status === "active" ? "Active" : "Disabled"} />
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
                          <Trash2 className="h-3.5 w-3.5" /> Revoke
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
          title="Game API endpoints"
          description="Bearer-authenticated routes for the game bot (Authorization: Bearer <key>)."
        />
        <CardBody>
          <div className="space-y-2">
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <code className="font-mono text-[12px] text-neutral-200">
                POST /api/integration/game/events
              </code>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Ingest game events — requires integration enabled and an active key.
              </p>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2">
              <code className="font-mono text-[12px] text-neutral-200">
                GET /api/integration/game/players
              </code>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Player roster: Game ID, nickname, faction and rank (limit 500).
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Create key dialog — plaintext key is shown exactly once. */}
      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title={created ? "API key created" : "Create API key"}
        description={
          created
            ? undefined
            : "The key will be generated with the default scopes: game:read, activity:write."
        }
        footer={
          created ? (
            <Button variant="primary" onClick={closeCreate} disabled={creating}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCreate} disabled={creating}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={() => void createKey()}>
                Create key
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="space-y-3">
            <p className="rounded-md border border-[#3d3316] bg-[#211c0d] px-3 py-2 text-xs text-warn">
              Store this key now — it will not be shown again.
            </p>
            <pre className="overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-[12px] text-neutral-200">
              {created.key}
            </pre>
            <Button variant="outline" size="sm" onClick={() => void copyKey()}>
              <Copy className="h-3.5 w-3.5" /> Copy
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
            <Field label="Key name" htmlFor="integration-key-name" error={nameError}>
              <Input
                id="integration-key-name"
                required
                minLength={2}
                maxLength={60}
                placeholder="e.g. game-bot-prod"
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
                title: "Revoke API key?",
                description: "The key stops working immediately. This cannot be undone.",
                fields: [{ label: "Key", value: revokeTarget.name }],
                confirmLabel: "Revoke key",
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
