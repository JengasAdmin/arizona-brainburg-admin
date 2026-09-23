/**
 * System settings catalog — pure data (importable by scripts, server and UI).
 */

export const DEFAULT_SETTINGS: Record<string, { value: unknown; description: string }> = {
  audit_store_ip: {
    value: true,
    description:
      "Хранить IP-адреса действующих лиц в журнале аудита (конфиденциальные данные — отключите, если это не оправдано).",
  },
  allow_negative_budget: {
    value: false,
    description: "Разрешить бюджетам фракций уходить в минус за счёт списаний.",
  },
  allow_multiple_active_terms: {
    value: false,
    description: "Разрешить одному пользователю иметь действующие сроки полномочий сразу в нескольких фракциях.",
  },
  registration_allowlist_enabled: {
    value: false,
    description: "Ограничить вход списком разрешённых Discord/VK ID (переменные окружения ALLOWLIST_*).",
  },
  integration_enabled: {
    value: false,
    description:
      "Включить будущий API интеграции с игровым ботом. По умолчанию выключен → статус «Не подключено».",
  },
  maintenance_mode: {
    value: false,
    description: "Блокировать доступ неадминистраторов на время технических работ.",
  },
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

/** Per-user notification preferences — defaults applied when a row is missing. */
export const DEFAULT_USER_PREFERENCES: Record<string, boolean> = {
  notify_leader_events: true,
  notify_disciplinary: true,
  notify_points: true,
  notify_roles: true,
  notify_budget: true,
  notify_system: true,
  digest_unread_badge: true,
};
