"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api-client";
import { formatAuditSentence } from "@/lib/audit-format";
import { formatDateTime } from "@/lib/utils";

interface AuditEntityRow {
  id: number;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  targetLabel: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditListResponse {
  items: AuditEntityRow[];
}

/**
 * Shared, reusable audit history for a single entity. Fetches
 * `GET /api/audit?entityType=…` client-side and narrows it to the given entity.
 */
export function EntityAuditList({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number | string;
}) {
  const [rows, setRows] = useState<AuditEntityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    api<AuditListResponse>(
      `/api/audit?entityType=${encodeURIComponent(entityType)}&pageSize=100`,
    )
      .then((data) => {
        if (cancelled) return;
        setRows(
          data.items.filter((item) => item.entityId != null && String(item.entityId) === String(entityId)),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (rows === null) {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="История пока не записана"
          description={error ?? "Записи аудита для этой сущности появятся здесь."}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table className="min-w-[640px]">
        <THead>
          <TR>
            <TH>Дата</TH>
            <TH>Автор</TH>
            <TH>Действие</TH>
            <TH>Подробности</TH>
            <TH>Причина</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="whitespace-nowrap text-neutral-500">{formatDateTime(row.createdAt)}</TD>
              <TD>{row.actorName ?? "Система"}</TD>
              <TD>
                <Badge tone="neutral">{row.action}</Badge>
              </TD>
              <TD className="max-w-[320px]">
                <div className="truncate text-neutral-300" title={formatAuditSentence(row)}>
                  {formatAuditSentence(row)}
                </div>
              </TD>
              <TD className="max-w-[200px] truncate text-neutral-500">{row.reason ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
