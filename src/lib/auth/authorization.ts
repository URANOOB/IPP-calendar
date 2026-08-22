import { requireAnyRole } from "@/lib/auth/user";
import type { UserRole } from "@/types/user";

export const dashboardRouteRoles: Record<string, readonly UserRole[]> = {
  "/dashboard": ["admin"],
  "/dashboard/contacts": ["admin"],
  "/dashboard/students": ["admin"],
  "/dashboard/teachers": ["admin"],
  "/dashboard/classes": ["admin"],
  "/dashboard/my-classes": ["admin"],
  "/dashboard/cycles": ["admin"],
  "/dashboard/tracking": ["admin"],
};

/** Enforces a route permission on the server, including when its URL is typed directly. */
export async function requireDashboardRoute(pathname: keyof typeof dashboardRouteRoles) {
  return requireAnyRole(dashboardRouteRoles[pathname]);
}
