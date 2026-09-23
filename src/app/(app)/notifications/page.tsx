import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { requirePageAuth } from "@/server/page-auth";
import { listNotifications } from "@/server/services/notifications";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime, cn } from "@/lib/utils";
import {
  NotificationActions,
  NotificationMarkRead,
} from "@/components/notifications/notification-actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function typeTone(type: string): "neutral" | "danger" | "ok" | "info" {
  if (["warning_received", "reprimand_received", "account_blocked"].includes(type)) return "danger";
  if (["account_unblocked", "game_id_verified"].includes(type)) return "ok";
  if (type === "system") return "info";
  return "neutral";
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors",
        active
          ? "border-line2 bg-raised text-white"
          : "border-line text-neutral-500 hover:text-neutral-300",
      )}
    >
      {children}
    </Link>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const auth = await requirePageAuth("VIEW_NOTIFICATIONS");
  const sp = await searchParams;

  const unreadOnly = sp.unread === "1" || sp.unread === "true";
  const rawPage = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const result = await listNotifications(auth.user.id, {
    unreadOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const from = (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    if (unreadOnly) params.set("unread", "1");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/notifications${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Уведомления"
        description={`${result.unread} непрочитанных · ${result.total} всего`}
        actions={<NotificationActions unread={result.unread} />}
      />

      <div className="mb-3 flex gap-2">
        <FilterChip href="/notifications" active={!unreadOnly}>
          Все
        </FilterChip>
        <FilterChip href="/notifications?unread=1" active={unreadOnly}>
          Непрочитанные{result.unread > 0 ? ` (${result.unread})` : ""}
        </FilterChip>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="Нет уведомлений."
            description={
              unreadOnly
                ? "У вас нет непрочитанных уведомлений."
                : "Уведомления о руководстве, ролях и вашей учётной записи появятся здесь."
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {result.items.map((n) => {
              const isUnread = n.readAt === null;
              const internalLink = n.link && n.link.startsWith("/") ? n.link : null;
              return (
                <Card key={n.id}>
                  <div className="flex items-start gap-3 p-4">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        isUnread ? "bg-blue-500" : "bg-neutral-700",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            isUnread ? "text-sm font-semibold text-white" : "text-sm font-medium text-neutral-300",
                          )}
                        >
                          {n.title}
                        </span>
                        <Badge tone={typeTone(n.type)}>{n.type.replace(/_/g, " ")}</Badge>
                        {internalLink ? (
                          <Link
                            href={internalLink}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 underline-offset-2 transition-colors hover:text-white hover:underline"
                          >
                            Подробнее <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] text-neutral-400">{n.body}</p>
                      <div className="mt-2 text-[11px] text-neutral-600">
                        {formatDateTime(n.createdAt)}
                      </div>
                    </div>
                    {isUnread ? <NotificationMarkRead id={n.id} /> : null}
                  </div>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-neutral-500">
              <span>
                {from}–{to} из {result.total}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={href(page - 1)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-raised px-2.5 text-neutral-300 transition-colors hover:border-line2 hover:text-white"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Назад
                  </Link>
                ) : (
                  <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 opacity-50">
                    <ChevronLeft className="h-3.5 w-3.5" /> Назад
                  </span>
                )}
                <span>
                  Страница {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={href(page + 1)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-raised px-2.5 text-neutral-300 transition-colors hover:border-line2 hover:text-white"
                  >
                    Вперёд <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 opacity-50">
                    Вперёд <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
