import { formatDateTime } from "@/lib/utils";

/**
 * Human-readable sentence for an audit entry, e.g.
 * «Главный администратор Ivan: назначение — Alexei — Chief of LSPD.»
 * Формулировки согласованы с объектом действия, а не с деятелем — род не важен.
 */
export function formatAuditSentence(row: {
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetLabel: string | null;
  reason: string | null;
}): string {
  const actor = row.actorName ? `${row.actorRole ? `${row.actorRole} ` : ""}${row.actorName}` : "Система";
  const target = row.targetLabel ?? "—";

  switch (row.action) {
    case "APPOINT_LEADER":
      return `${actor}: назначение — ${target}.`;
    case "APPOINT_DEPUTY":
      return `${actor}: назначение заместителя — ${target}.`;
    case "DISMISS_LEADER":
      return `${actor}: отстранение — ${target}.`;
    case "DISMISS_DEPUTY":
      return `${actor}: отстранение заместителя — ${target}.`;
    case "ADD_LEADERSHIP_POINTS":
      return `${actor}: начисление баллов лидерства — ${target}.`;
    case "REMOVE_LEADERSHIP_POINTS":
      return `${actor}: снятие баллов лидерства — ${target}.`;
    case "GIVE_WARNING":
      return `${actor}: выдано предупреждение — ${target}.`;
    case "GIVE_REPRIMAND":
      return `${actor}: выдан выговор — ${target}.`;
    case "BUDGET_DEPOSIT":
      return `${actor}: пополнение бюджета — ${target}.`;
    case "BUDGET_WITHDRAWAL":
      return `${actor}: списание с бюджета — ${target}.`;
    case "ASSIGN_ROLE":
      return `${actor}: назначена роль «${row.targetLabel ?? ""}».`;
    case "REMOVE_ROLE":
      return `${actor}: отозвана роль «${row.targetLabel ?? ""}».`;
    case "VERIFY_GAME_ID":
      return `${actor}: подтверждён Game ID — ${target}.`;
    case "REVOKE_GAME_ID":
      return `${actor}: отменена проверка Game ID — ${target}.`;
    case "SET_USER_STATUS":
      return `${actor}: изменён статус — ${target}.`;
    case "BLOCK_USERS":
      return `${actor}: блокировка — ${target}.`;
    case "CREATE_FACTION":
      return `${actor}: создана фракция — ${target}.`;
    case "UPDATE_FACTION":
      return `${actor}: обновлена фракция — ${target}.`;
    case "DELETE_FACTION":
      return `${actor}: удалена фракция — ${target}.`;
    case "UPDATE_ROLE_PERMISSIONS":
      return `${actor}: обновлены права роли — ${target}.`;
    case "UPDATE_SETTING":
      return `${actor}: изменена настройка — ${target}.`;
    case "LOGOUT":
      return `${actor}: выход из системы.`;
    default:
      return `${actor}: действие ${row.action} — ${target}.`;
  }
}

export { formatDateTime };
