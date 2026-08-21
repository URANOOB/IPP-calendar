import { requireAnyRole } from "@/lib/auth/user";
import type { UserRole } from "@/types/user";

export const dashboardRouteRoles: Record<string, readonly UserRole[]> = {
  "/dashboard": ["admin", "teacher", "contact_manager"],
  "/dashboard/contacts": ["admin", "contact_manager"],
  "/dashboard/contactos": ["admin", "contact_manager"],
  "/dashboard/students": ["admin", "contact_manager"],
  "/dashboard/estudiantes": ["admin", "contact_manager"],
  "/dashboard/teachers": ["admin"],
  "/dashboard/profesores": ["admin"],
  "/dashboard/classes": ["admin", "teacher", "contact_manager"],
  "/dashboard/clases": ["admin", "teacher", "contact_manager"],
  "/dashboard/my-classes": ["teacher"],
  "/dashboard/cycles": ["admin"],
  "/dashboard/ciclos": ["admin"],
  "/dashboard/tracking": ["admin", "contact_manager"],
  "/dashboard/seguimiento": ["admin", "contact_manager"],
  "/dashboard/settings": ["admin"],
};

/** Enforces a route permission on the server, including when its URL is typed directly. */
export async function requireDashboardRoute(pathname: keyof typeof dashboardRouteRoles) {
  return requireAnyRole(dashboardRouteRoles[pathname]);
}
