import { requirePageAuth } from "@/server/page-auth";
import { getAllSettings } from "@/server/services/settings";
import { getIntegrationStatus, listIntegrationKeys } from "@/server/services/integration";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  SettingsTabs,
  type SettingsPanel,
  type SettingsTabDef,
} from "@/components/settings/settings-tabs";
import { AccountForm } from "@/components/settings/account-form";
import { NotificationPrefs } from "@/components/settings/notification-prefs";
import { SystemSettingsGroup } from "@/components/settings/system-settings-group";
import { IntegrationPanel } from "@/components/settings/integration-panel";
import { SecurityPanel } from "@/components/settings/security-panel";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PROVIDER_ROWS = [
  { key: "discord", label: "Discord" },
  { key: "vk", label: "VK" },
] as const;

function AccountRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 last:border-b-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-neutral-200">{children}</span>
    </div>
  );
}

/**
 * Settings hub. The (app) layout already guarantees an authenticated session
 * for every page; requirePageAuth() with no argument enforces exactly that
 * (redirects to the session-expired landing page) WITHOUT demanding a single
 * permission — own-account settings must stay reachable for every role, while
 * the System / Integration tabs are gated per-tab by their real permission keys.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const auth = await requirePageAuth();
  const sp = await searchParams;

  const canSystem = auth.permissions.has("SYSTEM_SETTINGS");
  const canIntegration = auth.permissions.has("VIEW_INTEGRATION");
  const canManageKeys = auth.permissions.has("MANAGE_INTEGRATION");

  const settingsRows = canSystem
    ? (await getAllSettings()).map((row) => ({
        key: row.key,
        value: row.value as unknown,
        description: row.description,
        updatedAt: row.updatedAt.toISOString(),
      }))
    : [];

  const integration = canIntegration
    ? {
        info: await getIntegrationStatus(),
        keys: await listIntegrationKeys(),
      }
    : null;

  const tabs: SettingsTabDef[] = [
    { id: "account", label: "Учётная запись" },
    { id: "connected", label: "Подключения" },
    { id: "notifications", label: "Уведомления" },
    { id: "security", label: "Безопасность" },
    ...(canSystem ? [{ id: "system", label: "Система" }] : []),
    ...(canIntegration ? [{ id: "integration", label: "Интеграция" }] : []),
  ];

  const requestedTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const defaultTab =
    requestedTab && tabs.some((tab) => tab.id === requestedTab) ? requestedTab : undefined;

  const roles = [...auth.actor.roles].sort((a, b) => b.level - a.level);

  const accountPanel = (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Профиль"
          description="Данные вашей учётной записи."
          actions={
            <AccountForm
              profile={{
                id: auth.user.id,
                displayName: auth.user.displayName,
                nickname: auth.user.nickname,
                branch: auth.user.branch,
                gameId: auth.user.gameId,
              }}
            />
          }
        />
        <CardBody>
          <AccountRow label="Отображаемое имя">{auth.user.displayName}</AccountRow>
          <AccountRow label="Никнейм">{auth.user.nickname ?? "—"}</AccountRow>
          <AccountRow label="Ветка">{auth.user.branch ?? "—"}</AccountRow>
          <AccountRow label="Game ID">
            {auth.user.gameId ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{auth.user.gameId}</span>
                <Badge tone={auth.user.gameIdVerifiedAt ? "ok" : "warn"}>
                  {auth.user.gameIdVerifiedAt ? "Подтверждён" : "Не подтверждён"}
                </Badge>
              </span>
            ) : (
              "—"
            )}
          </AccountRow>
          <AccountRow label="Статус">
            <StatusBadge status={auth.user.status} />
          </AccountRow>
          <AccountRow label="Сервер">#{auth.user.serverNumber}</AccountRow>
          <AccountRow label="Аккаунт создан">{formatDateTime(auth.user.createdAt)}</AccountRow>
          <AccountRow label="Последний вход">{formatDateTime(auth.user.lastLoginAt)}</AccountRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Роли" description="Роли, назначенные вашей учётной записи." />
        <CardBody>
          {roles.length === 0 ? (
            <p className="text-[13px] text-neutral-500">Роли не назначены.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <Badge key={role.key} tone="neutral">
                  {role.name}
                </Badge>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  const connectedPanel = (
    <Card>
      <CardHeader
        title="Подключённые аккаунты"
        description="Подключение внешних учётных записей для входа."
      />
      <CardBody padded={false}>
        <div className="divide-y divide-line">
          {PROVIDER_ROWS.map((provider) => {
            const account = auth.connectedProviders.find((p) => p.provider === provider.key);
            return (
              <div key={provider.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-neutral-200">{provider.label}</div>
                  <div className="text-[11px] text-neutral-600">
                    {account ? (account.username ?? "Подключено") : "Не подключено"}
                  </div>
                </div>
                {account ? (
                  <Badge tone="ok" dot>
                    Подключено
                  </Badge>
                ) : (
                  <a
                    href={`/api/auth/${provider.key}?mode=link&redirectTo=/settings`}
                    className="inline-flex h-7 items-center rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-neutral-200 transition-colors hover:border-line2 hover:text-white"
                  >
                    Подключить {provider.label}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );

  const panels: SettingsPanel[] = [
    { id: "account", content: accountPanel },
    { id: "connected", content: connectedPanel },
    { id: "notifications", content: <NotificationPrefs /> },
    {
      id: "security",
      content: (
        <SecurityPanel
          createdAt={auth.user.createdAt.toISOString()}
          lastLoginAt={auth.user.lastLoginAt?.toISOString() ?? null}
          providers={auth.connectedProviders.map((p) => ({
            provider: p.provider,
            username: p.username,
          }))}
        />
      ),
    },
    ...(canSystem
      ? [{ id: "system", content: <SystemSettingsGroup items={settingsRows} /> }]
      : []),
    ...(canIntegration && integration
      ? [
          {
            id: "integration",
            content: (
              <IntegrationPanel
                info={integration.info}
                keys={integration.keys}
                canManage={canManageKeys}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Настройки"
        description="Ваш аккаунт, настройки, безопасность сессии и — где разрешено — конфигурация платформы."
      />
      <SettingsTabs tabs={tabs} defaultTab={defaultTab} panels={panels} />
    </div>
  );
}
