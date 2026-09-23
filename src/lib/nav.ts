import {
  Activity,
  Banknote,
  Bell,
  Building2,
  FileClock,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  UserSquare2,
  Crown,
} from "lucide-react";
import type { PermissionKey } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hidden without this permission — the backend enforces it as well. */
  permission?: PermissionKey;
  section?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
  { href: "/users", label: "Users", icon: Users, permission: "VIEW_USERS" },
  { href: "/leaders", label: "Leaders", icon: Crown, permission: "VIEW_LEADERS" },
  { href: "/deputies", label: "Deputies", icon: UserSquare2, permission: "VIEW_DEPUTIES" },
  { href: "/factions", label: "Factions", icon: Building2, permission: "VIEW_FACTIONS" },
  { href: "/budgets", label: "Budgets", icon: Banknote, permission: "VIEW_BUDGET" },
  { href: "/activity", label: "Activity", icon: Activity, permission: "VIEW_ACTIVITY" },
  { href: "/notifications", label: "Notifications", icon: Bell, permission: "VIEW_NOTIFICATIONS" },
  { href: "/audit", label: "Audit Logs", icon: FileClock, permission: "VIEW_AUDIT_LOGS" },
  {
    href: "/admin",
    label: "Administration",
    icon: Shield,
    permission: "MANAGE_ROLES",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];
