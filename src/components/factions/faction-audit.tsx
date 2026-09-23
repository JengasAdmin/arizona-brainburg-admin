"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { formatAuditSentence } from "@/lib/audit-format";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FileClock } from "lucide-react";

/** Subset of GET /api/audit rows needed for the entity audit list. */
interface AuditRow {
  id: number;
  entityId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetLabel: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditResult {
  items: AuditRow[];
}

/**
 * Client-side audit history for one faction. Fetches GET /api/audit filtered by
 * entityType=faction (the audit query schema has no entityId filter, so rows are
 * narrowed to this faction client-side). Requires VIEW_AUDIT_LOGS — degrades to
 * an empty state when the viewer lacks it.
 */
export function FactionAudit({ factionId }: { factionId: number }) {
  const [items, setItems] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api<AuditResult>(
          `/api/audit?entityType=faction&pageSize=100`,
          { method: "GET" },
        );
        if (cancelled) return;
        setItems(result.items.filter((row) => row.entityId === String(factionId)));
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [factionId]);

  if (error) {
    return (
      <EmptyState
        icon={<FileClock className="h-8 w-8" />}
        title="Audit log unavailable"
        description={error}
      />
    );
  }

  if (items === null) return <Spinner />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<FileClock className="h-8 w-8" />}
        title="No audit entries"
        description="Changes to this faction will be recorded here."
      />
    );
  }

  return (
    <Table className="min-w-[560px]">
      <THead>
        <TR>
          <TH>Actor</TH>
          <TH>Action</TH>
          <TH>Entry</TH>
          <TH align="right">Date</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((row) => (
          <TR key={row.id}>
            <TD>
              <div className="text-neutral-200">{row.actorName ?? "System"}</div>
              {row.actorRole ? (
                <div className="text-[11px] text-neutral-600">{row.actorRole}</div>
              ) : null}
            </TD>
            <TD>
              <Badge tone="neutral">{row.action}</Badge>
            </TD>
            <TD className="max-w-[280px]">
              <div className="truncate text-neutral-300" title={formatAuditSentence(row)}>
                {formatAuditSentence(row)}
              </div>
              {row.reason ? (
                <div className="truncate text-[11px] text-neutral-600">{row.reason}</div>
              ) : null}
            </TD>
            <TD align="right" className="whitespace-nowrap text-neutral-500">
              {formatDateTime(row.createdAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
