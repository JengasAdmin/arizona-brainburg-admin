import { formatDateTime } from "@/lib/utils";

/**
 * Human-readable sentence for an audit entry, e.g.
 * "Administrator appointed Vyacheslav_Gorbunov as Chief of LSPD."
 */
export function formatAuditSentence(row: {
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetLabel: string | null;
  reason: string | null;
}): string {
  const actor = row.actorName ? `${row.actorRole ? `${row.actorRole} ` : ""}${row.actorName}` : "System";
  const target = row.targetLabel ?? "—";

  switch (row.action) {
    case "APPOINT_LEADER":
      return `${actor} appointed ${target}.`;
    case "APPOINT_DEPUTY":
      return `${actor} appointed ${target}.`;
    case "DISMISS_LEADER":
      return `${actor} dismissed ${target}.`;
    case "DISMISS_DEPUTY":
      return `${actor} dismissed ${target}.`;
    case "ADD_LEADERSHIP_POINTS":
      return `${actor} added leadership points to ${target}.`;
    case "REMOVE_LEADERSHIP_POINTS":
      return `${actor} removed leadership points from ${target}.`;
    case "GIVE_WARNING":
      return `${actor} issued a warning to ${target}.`;
    case "GIVE_REPRIMAND":
      return `${actor} issued a reprimand to ${target}.`;
    case "BUDGET_DEPOSIT":
      return `${actor} deposited funds to ${target}.`;
    case "BUDGET_WITHDRAWAL":
      return `${actor} withdrew funds from ${target}.`;
    case "ASSIGN_ROLE":
      return `${actor} assigned the role “${row.targetLabel ?? ""}”.`;
    case "REMOVE_ROLE":
      return `${actor} removed the role “${row.targetLabel ?? ""}”.`;
    case "VERIFY_GAME_ID":
      return `${actor} verified the Game ID of ${target}.`;
    case "REVOKE_GAME_ID":
      return `${actor} revoked the Game ID verification of ${target}.`;
    case "SET_USER_STATUS":
      return `${actor} changed the status of ${target}.`;
    case "BLOCK_USERS":
      return `${actor} blocked ${target}.`;
    case "CREATE_FACTION":
      return `${actor} created the faction ${target}.`;
    case "UPDATE_FACTION":
      return `${actor} updated the faction ${target}.`;
    case "DELETE_FACTION":
      return `${actor} deleted the faction ${target}.`;
    case "UPDATE_ROLE_PERMISSIONS":
      return `${actor} updated permissions of the role ${target}.`;
    case "UPDATE_SETTING":
      return `${actor} changed the setting ${target}.`;
    case "LOGOUT":
      return `${actor} signed out.`;
    default:
      return `${actor} performed ${row.action} on ${target}.`;
  }
}

export { formatDateTime };
