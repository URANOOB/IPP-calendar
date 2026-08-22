import { requireAnyRole } from "@/lib/auth/user";
import type { UserRole } from "@/types/user";

export const dashboardRouteRoles: Record<string, readonly UserRole[]> = {
  "/dashboard": ["admin", "manager"],
  "/dashboard/contacts": ["admin", "manager"],
  "/dashboard/students": ["admin", "manager"],
  "/dashboard/teachers": ["admin", "manager"],
  "/dashboard/classes": ["admin", "manager"],
  "/dashboard/cycles": ["admin", "manager"],
  "/dashboard/tracking": ["admin", "manager"],
};

/** Enforces a route permission on the server, including when its URL is typed directly. */
export async function requireDashboardRoute(pathname: keyof typeof dashboardRouteRoles) {
  return requireAnyRole(dashboardRouteRoles[pathname]);
}
