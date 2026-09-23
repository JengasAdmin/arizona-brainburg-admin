import "server-only";
import { redirect } from "next/navigation";
import { getAuth, type AuthContext } from "./auth/access";
import { can, type PermissionKey } from "@/lib/rbac";

/**
 * Page-level authorization. Server components only — a missing permission sends
 * the user to the dedicated 403 page instead of leaking data.
 */
export async function requirePageAuth(permission?: PermissionKey): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/?error=session_expired");
  if (permission && !can(auth.actor, permission).allowed) {
    redirect(`/403?p=${encodeURIComponent(permission)}`);
  }
  return auth;
}
