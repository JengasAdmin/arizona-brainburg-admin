"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatAuditSentence } from "@/lib/audit-format";
import { formatDateTime, formatUserId } from "@/lib/utils";

export interface AuditRowData {
  id: number;
  actorId: number | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  targetLabel: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  ip: string | null;
  departmentId: number | null;
  createdAt: string;
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-1.5 last:border-b-0">
      <dt className="text-[11px] text-neutral-600">{label}</dt>
      <dd className="min-w-0 text-right text-xs text-neutral-300">{value}</dd>
    </div>
  );
}

/**
 * One audit entry: a clickable row that expands into the full formatted entry
 * plus the raw metadata. Audit data is immutable — no edit/delete affordances.
 */
export function AuditExpandRow({ row, entityHref }: { row: AuditRowData; entityHref: string | null }) {
  const [open, setOpen] = useState(false);
  const sentence = formatAuditSentence(row);
  const hasMetadata =
    row.oldValue != null ||
    row.newValue != null ||
    row.reason !== null ||
    row.ip !== null ||
    row.departmentId !== null;

  return (
    <>
      <TR onClick={() => setOpen((prev) => !prev)}>
        <TD className="whitespace-nowrap font-mono text-[12px] text-neutral-400">
          {formatDateTime(row.createdAt)}
        </TD>
        <TD>
          <div className="text-neutral-200">{row.actorName ?? "Система"}</div>
          <div className="font-mono text-[11px] text-neutral-600">
            {row.actorId != null ? formatUserId(row.actorId) : "—"}
          </div>
        </TD>
        <TD>
          <Badge tone="neutral">{row.action}</Badge>
        </TD>
        <TD>
          <div className="text-[12px] text-neutral-300">{row.entityType}</div>
          {row.entityId ? (
            entityHref ? (
              <Link
                href={entityHref}
                className="font-mono text-[11px] text-neutral-500 underline-offset-2 transition-colors hover:text-white hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.entityId}
              </Link>
            ) : (
              <div className="font-mono text-[11px] text-neutral-600">{row.entityId}</div>
            )
          ) : (
            <div className="text-[11px] text-neutral-600">—</div>
          )}
        </TD>
        <TD className="max-w-[260px]">
          <div className="truncate text-neutral-400" title={sentence}>
            {sentence}
          </div>
        </TD>
        <TD className="whitespace-nowrap font-mono text-[12px] text-neutral-500">
          {row.ip ?? "—"}
        </TD>
        <TD align="right" className="w-8 text-neutral-600">
          {open ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
        </TD>
      </TR>
      {open ? (
        <tr className="bg-panel/50">
          <td colSpan={7} className="border-b border-line/70 px-3 py-3">
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                  Запись
                </div>
                <p className="mt-1 text-[13px] text-neutral-200">{sentence}</p>
              </div>
              <dl className="grid max-w-2xl grid-cols-1 gap-x-6 sm:grid-cols-2">
                <Meta label="Время" value={<span className="font-mono">{formatDateTime(row.createdAt)}</span>} />
                <Meta
                  label="Автор"
                  value={
                    <>
                      {row.actorName ?? "Система"}
                      {row.actorRole ? <span className="text-neutral-500"> · {row.actorRole}</span> : null}
                      {row.actorId != null ? (
                        <span className="ml-1 font-mono text-neutral-500">{formatUserId(row.actorId)}</span>
                      ) : null}
                    </>
                  }
                />
                <Meta label="Действие" value={<Badge tone="neutral">{row.action}</Badge>} />
                <Meta
                  label="Сущность"
                  value={
                    <>
                      {row.entityType}
                      {row.entityId ? <span className="ml-1 font-mono text-neutral-500">{row.entityId}</span> : null}
                    </>
                  }
                />
                <Meta label="Цель" value={row.targetLabel ?? "—"} />
                <Meta label="Причина" value={row.reason ?? "—"} />
                <Meta label="IP" value={<span className="font-mono">{row.ip ?? "—"}</span>} />
                <Meta label="Направление" value={row.departmentId != null ? String(row.departmentId) : "—"} />
              </dl>
              {hasMetadata ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                    Метаданные
                  </div>
                  <pre className="mt-1 max-w-3xl overflow-x-auto rounded-md border border-line bg-card p-3 text-[11px] leading-relaxed text-neutral-400">
                    {JSON.stringify(
                      {
                        oldValue: row.oldValue,
                        newValue: row.newValue,
                        reason: row.reason,
                        ip: row.ip,
                        departmentId: row.departmentId,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
