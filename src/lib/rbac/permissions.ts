/**
 * Permission catalog — the single source of truth for RBAC.
 * Seeded into the `permissions` table by `scripts/seed.ts`.
 *
 * `scoped: true`  → the permission may be granted to a department-scoped role
 *                   (specialized supervisors only act inside their own direction).
 * `critical: true`→ only Site Founder / Chief Administrator / Deputy Chief
 *                   Administrator / Curator may hold or grant it.
 */
export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  group:
    | "Обзор"
    | "Пользователи"
    | "Руководство"
    | "Заместители"
    | "Фракции"
    | "Бюджет"
    | "Активность"
    | "Журналы"
    | "Уведомления"
    | "Администрирование"
    | "Система"
    | "Интеграция";
  description: string;
  scoped: boolean;
  critical: boolean;
}

export const PERMISSION_KEYS = [
  "VIEW_DASHBOARD",
  "VIEW_USERS",
  "EDIT_USERS",
  "BLOCK_USERS",
  "VIEW_PROFILES",
  "EDIT_PROFILES",
  "VERIFY_GAME_ID",
  "VIEW_LEADERS",
  "APPOINT_LEADER",
  "DISMISS_LEADER",
  "EDIT_LEADER",
  "EDIT_LEADER_POINTS",
  "GIVE_WARNING",
  "GIVE_REPRIMAND",
  "VIEW_DEPUTIES",
  "MANAGE_DEPUTIES",
  "VIEW_FACTIONS",
  "CREATE_FACTION",
  "EDIT_FACTION",
  "DELETE_FACTION",
  "MANAGE_FACTION_MEMBERS",
  "VIEW_BUDGET",
  "MANAGE_BUDGET",
  "VIEW_ACTIVITY",
  "CREATE_GAME_ACTIVITY",
  "VIEW_LOGS",
  "CREATE_LOG",
  "VIEW_AUDIT_LOGS",
  "VIEW_NOTIFICATIONS",
  "MANAGE_NOTIFICATIONS",
  "MANAGE_ADMINS",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
  "SYSTEM_SETTINGS",
  "VIEW_INTEGRATION",
  "MANAGE_INTEGRATION",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const p = (
  key: PermissionKey,
  name: string,
  group: PermissionDefinition["group"],
  description: string,
  opts: Partial<Pick<PermissionDefinition, "scoped" | "critical">> = {},
): PermissionDefinition => ({
  key,
  name,
  group,
  description,
  scoped: opts.scoped ?? true,
  critical: opts.critical ?? false,
});

export const PERMISSIONS: PermissionDefinition[] = [
  p("VIEW_DASHBOARD", "Просмотр обзора", "Обзор", "Открывать панель администрирования.", {
    scoped: false,
  }),
  p("VIEW_USERS", "Просмотр пользователей", "Пользователи", "Видеть список пользователей и фильтры."),
  p("EDIT_USERS", "Редактирование пользователей", "Пользователи", "Изменять данные профиля, статус и Game ID."),
  p("BLOCK_USERS", "Блокировка пользователей", "Пользователи", "Приостанавливать и блокировать учётные записи."),
  p("VIEW_PROFILES", "Просмотр профилей", "Пользователи", "Открывать полные профили пользователей."),
  p("EDIT_PROFILES", "Редактирование профилей", "Пользователи", "Изменять ники, ветки и поля профиля."),
  p("VERIFY_GAME_ID", "Подтверждение Game ID", "Пользователи", "Подтверждать Arizona RP Game ID пользователя."),

  p("VIEW_LEADERS", "Просмотр руководителей", "Руководство", "Видеть должности и сроки полномочий."),
  p("APPOINT_LEADER", "Назначение руководителя", "Руководство", "Создавать новый срок полномочий."),
  p("DISMISS_LEADER", "Отстранение руководителя", "Руководство", "Закрывать действующий срок полномочий."),
  p("EDIT_LEADER", "Редактирование руководителя", "Руководство", "Изменять ранг и данные срока."),
  p("EDIT_LEADER_POINTS", "Управление баллами руководства", "Руководство", "Начислять и снимать баллы руководства."),
  p("GIVE_WARNING", "Выдача предупреждения", "Руководство", "Выдавать предупреждение руководителю или заместителю."),
  p("GIVE_REPRIMAND", "Выдача выговора", "Руководство", "Выдавать выговор руководителю или заместителю."),

  p("VIEW_DEPUTIES", "Просмотр заместителей", "Заместители", "Видеть сроки полномочий заместителей и историю."),
  p("MANAGE_DEPUTIES", "Управление заместителями", "Заместители", "Назначать и отстранять заместителей."),

  p("VIEW_FACTIONS", "Просмотр фракций", "Фракции", "Видеть все фракции."),
  p("CREATE_FACTION", "Создание фракции", "Фракции", "Создавать новые фракции."),
  p("EDIT_FACTION", "Редактирование фракции", "Фракции", "Изменять данные фракции и должности."),
  p("DELETE_FACTION", "Удаление фракции", "Фракции", "Удалять фракцию (критическое).", {
    critical: true,
  }),
  p("MANAGE_FACTION_MEMBERS", "Управление составом фракции", "Фракции", "Изменять состав фракции."),

  p("VIEW_BUDGET", "Просмотр бюджета", "Бюджет", "Видеть бюджеты фракций и транзакции."),
  p("MANAGE_BUDGET", "Управление бюджетом", "Бюджет", "Создавать пополнения и списания (критический журнал).", {
    critical: true,
  }),

  p("VIEW_ACTIVITY", "Просмотр активности", "Активность", "Видеть ручную и интеграционную игровую активность."),
  p("CREATE_GAME_ACTIVITY", "Создание записи активности", "Активность", "Вносить записи игровой активности вручную."),

  p("VIEW_LOGS", "Просмотр журналов", "Журналы", "Читать журналы активности в своей области."),
  p("CREATE_LOG", "Создание записи журнала", "Журналы", "Создавать записи журнала вручную."),
  p("VIEW_AUDIT_LOGS", "Просмотр журнала аудита", "Журналы", "Читать неизменяемый журнал аудита (критическое).", {
    critical: true,
  }),

  p("VIEW_NOTIFICATIONS", "Просмотр уведомлений", "Уведомления", "Читать свои уведомления.", {
    scoped: false,
  }),
  p("MANAGE_NOTIFICATIONS", "Отправка уведомлений", "Уведомления", "Отправлять системные уведомления.", {
    scoped: false,
  }),

  p("MANAGE_ADMINS", "Управление администраторами", "Администрирование", "Назначать административные роли (критическое).", {
    scoped: false,
    critical: true,
  }),
  p("MANAGE_ROLES", "Управление ролями", "Администрирование", "Создавать и назначать роли в рамках иерархии (критическое).", {
    scoped: false,
    critical: true,
  }),
  p("MANAGE_PERMISSIONS", "Управление разрешениями", "Администрирование", "Изменять наборы разрешений ролей (критическое).", {
    scoped: false,
    critical: true,
  }),
  p("SYSTEM_SETTINGS", "Системные настройки", "Система", "Изменять глобальные системные настройки (критическое).", {
    scoped: false,
    critical: true,
  }),

  p("VIEW_INTEGRATION", "Просмотр интеграции", "Интеграция", "Видеть статус интеграции и ключи API.", {
    scoped: false,
  }),
  p("MANAGE_INTEGRATION", "Управление интеграцией", "Интеграция", "Создавать и отключать ключи API интеграции (критическое).", {
    scoped: false,
    critical: true,
  }),
];

export const PERMISSION_MAP: Record<PermissionKey, PermissionDefinition> = Object.fromEntries(
  PERMISSIONS.map((perm) => [perm.key, perm]),
) as Record<PermissionKey, PermissionDefinition>;

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}
