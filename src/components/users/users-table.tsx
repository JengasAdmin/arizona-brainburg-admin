"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { GameIdDialog } from "./game-id-dialog";
import { RoleAssignDialog, type AssignableRole } from "./role-assign-dialog";
import { StatusDialog } from "./status-dialog";

export interface UsersTableRow {
  id: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  gameId: string | null;
  gameIdVerified: boolean;
  status: string;
  lastLoginAt: string | null;
  roles: { key: string; name: string }[];
}

export interface UsersTableFilters {
  q?: string;
  status?: string;
}

export interface UsersTablePagination {
  page: number;
  pageSize: number;
  total: number;
}

function usersHref(filters: UsersTableFilters, page?: number): string {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.status) params.set("status", filters.status);
  if (page !== undefined && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}

/** Toolbar: debounced search (350ms, replaces ?q=, resets page) + status filter + count. */
function UsersToolbar({
  filters,
  statuses,
  total,
}: {
  filters: UsersTableFilters;
  statuses: { value: string; label: string }[];
  total: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(filters.q ?? "");

  useEffect(() => {
    const next = value.trim();
    if (next === (filters.q ?? "").trim()) return;
    const timer = window.setTimeout(() => {
      router.replace(usersHref({ q: next, status: filters.status }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value, filters.q, filters.status, router]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Поиск по имени, нику, ID или Game ID…"
          aria-label="Поиск пользователей"
          className="pl-8"
        />
      </div>
      <Select
        value={filters.status ?? ""}
        onChange={(e) => router.replace(usersHref({ q: value, status: e.target.value }))}
        aria-label="Фильтр по статусу"
        className="w-[150px]"
      >
        {statuses.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <span className="whitespace-nowrap text-xs text-neutral-500">
        {total.toLocaleString("en-US")}{" "}
        {total % 10 === 1 && total % 100 !== 11
          ? "результат"
          : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 12 || total % 100 > 14)
            ? "результата"
            : "результатов"}
      </span>
    </div>
  );
}

/** ⋯ menu with permission-guarded actions for one row. */
function RowActions({
  row,
  canEditStatus,
  canEditGameId,
  canAssignRoles,
  canViewAudit,
  assignableRoles,
}: {
  row: UsersTableRow;
  canEditStatus: boolean;
  canEditGameId: boolean;
  canAssignRoles: boolean;
  canViewAudit: boolean;
  assignableRoles: AssignableRole[];
}) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [gameIdOpen, setGameIdOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const assignableForUser = assignableRoles.filter(
    (role) => !row.roles.some((assigned) => assigned.key === role.key),
  );

  return (
    <span className="inline-block" onClick={(e) => e.stopPropagation()}>
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={`Действия для ${row.displayName}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-raised hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
      >
        {(close) => (
          <>
            <DropdownItem
              onClick={() => {
                close();
                router.push(`/users/${row.id}`);
              }}
            >
              Открыть профиль
            </DropdownItem>
            {canEditStatus ? (
              <DropdownItem
                onClick={() => {
                  close();
                  setStatusOpen(true);
                }}
              >
                Изменить статус
              </DropdownItem>
            ) : null}
            {canEditGameId ? (
              <DropdownItem
                onClick={() => {
                  close();
                  setGameIdOpen(true);
                }}
              >
                Изменить Game ID
              </DropdownItem>
            ) : null}
            {canAssignRoles && assignableForUser.length > 0 ? (
              <DropdownItem
                onClick={() => {
                  close();
                  setRoleOpen(true);
                }}
              >
                Назначить роль
              </DropdownItem>
            ) : null}
            {canViewAudit ? (
              <DropdownItem
                onClick={() => {
                  close();
                  router.push(`/audit?entityType=user&entityId=${row.id}`);
                }}
              >
                Журнал аудита
              </DropdownItem>
            ) : null}
          </>
        )}
      </Dropdown>

      <StatusDialog
        userId={row.id}
        currentStatus={row.status}
        open={statusOpen}
        onOpenChange={setStatusOpen}
      />
      <GameIdDialog
        userId={row.id}
        currentGameId={row.gameId}
        open={gameIdOpen}
        onOpenChange={setGameIdOpen}
      />
      <RoleAssignDialog
        userId={row.id}
        roles={assignableRoles}
        assignedKeys={row.roles.map((role) => role.key)}
        open={roleOpen}
        onOpenChange={setRoleOpen}
      />
    </span>
  );
}

export function UsersTable({
  rows,
  pagination,
  filters,
  statuses,
  canEditStatus,
  canEditGameId,
  canAssignRoles,
  canViewAudit,
  assignableRoles,
}: {
  rows: UsersTableRow[];
  pagination: UsersTablePagination;
  filters: UsersTableFilters;
  statuses: { value: string; label: string }[];
  canEditStatus: boolean;
  canEditGameId: boolean;
  canAssignRoles: boolean;
  canViewAudit: boolean;
  assignableRoles: AssignableRole[];
}) {
  const router = useRouter();

  return (
    <Card>
      <UsersToolbar filters={filters} statuses={statuses} total={pagination.total} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Пользователи не найдены"
          description="Измените запрос или фильтр статуса и попробуйте снова."
        />
      ) : (
        <Table className="min-w-[880px]">
          <THead>
            <TR>
              <TH>Игрок</TH>
              <TH>ID пользователя</TH>
              <TH>Статус</TH>
              <TH>Game ID</TH>
              <TH>Роли</TH>
              <TH>Последний вход</TH>
              <TH align="right">Действия</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id} onClick={() => router.push(`/users/${row.id}`)}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar src={row.avatarUrl} name={row.displayName} size={28} />
                    <div className="min-w-0">
                      <div className="truncate text-neutral-200">{row.displayName}</div>
                      <div className="truncate text-[11px] text-neutral-600">
                        {row.nickname ?? "—"}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <span className="font-mono text-neutral-400">#{row.id}</span>
                </TD>
                <TD>
                  <StatusBadge status={row.status} />
                </TD>
                <TD>
                  {row.gameId ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-neutral-300">{row.gameId}</span>
                      {!row.gameIdVerified ? (
                        <Badge tone="warn">Не подтверждён</Badge>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </TD>
                <TD>
                  {row.roles.length === 0 ? (
                    <span className="text-neutral-600">—</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      {row.roles.slice(0, 3).map((role) => (
                        <Badge key={role.key} tone="neutral">
                          {role.name}
                        </Badge>
                      ))}
                      {row.roles.length > 3 ? (
                        <Badge tone="neutral">+{row.roles.length - 3}</Badge>
                      ) : null}
                    </div>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-neutral-500">
                  {formatDateTime(row.lastLoginAt)}
                </TD>
                <TD align="right">
                  <span className="inline-block" onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      row={row}
                      canEditStatus={canEditStatus}
                      canEditGameId={canEditGameId}
                      canAssignRoles={canAssignRoles}
                      canViewAudit={canViewAudit}
                      assignableRoles={assignableRoles}
                    />
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPage={(page) => router.push(usersHref(filters, page))}
      />
    </Card>
  );
}
