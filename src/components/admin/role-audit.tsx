"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState, Spinner } from "@/components/ui/empty";
import { api, errorMessage } from "@/lib/api-client";
import { formatAuditSentence, formatDateTime } from "@/lib/audit-format";

/** Subset of the audit row returned by GET /api/audit. */
interface AuditEntry {
  id: number;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityId: string | null;
  targetLabel: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Audit preview for a single role. The API supports `entityType` but not
 * `entityId`, so we fetch role-entity entries and filter by the exact role key
 * client-side (entityId is written as the role key by the roles service).
 */
export function RoleAudit({ roleKey }: { roleKey: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const res = await api<AuditPage>("/api/audit?entityType=role&pageSize=100");
        if (cancelled) return;
        setItems(res.items.filter((item) => item.entityId === roleKey));
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleKey]);

  return (
    <Card>
      <CardHeader
        title="История аудита"
        description="Неизменяемые записи аудита, относящиеся к этой роли."
      />
      {status === "loading" ? (
        <Spinner />
      ) : status === "error" ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" />}
          title="Журнал аудита недоступен"
          description={error}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" />}
          title="Записей аудита пока нет"
          description="Изменения прав и другие действия с ролью появятся здесь после записи."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <THead>
              <TR>
                <TH>Запись</TH>
                <TH>Причина</TH>
                <TH align="right">Дата</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((row) => (
                <TR key={row.id}>
                  <TD className="max-w-[420px]">
                    <div className="truncate text-neutral-300" title={formatAuditSentence(row)}>
                      {formatAuditSentence(row)}
                    </div>
                  </TD>
                  <TD className="max-w-[200px] truncate text-neutral-500">{row.reason ?? "—"}</TD>
                  <TD align="right" className="whitespace-nowrap text-neutral-500">
                    {formatDateTime(row.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
