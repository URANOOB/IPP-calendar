import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, CalendarDays, GraduationCap, LayoutDashboard, Users, UserRoundCog, Waypoints } from "lucide-react";

import type { UserRole } from "@/types/user";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
}

export const dashboardNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "teacher", "contact_manager"] },
  { label: "Contactos", href: "/dashboard/contacts", icon: Users, roles: ["admin", "contact_manager"] },
  { label: "Estudiantes", href: "/dashboard/students", icon: GraduationCap, roles: ["admin", "contact_manager"] },
  { label: "Profesores", href: "/dashboard/teachers", icon: UserRoundCog, roles: ["admin"] },
  { label: "Clases", href: "/dashboard/classes", icon: BookOpenCheck, roles: ["admin", "contact_manager"] },
  { label: "Mis clases", href: "/dashboard/my-classes", icon: BookOpenCheck, roles: ["teacher"] },
  { label: "Ciclos", href: "/dashboard/cycles", icon: CalendarDays, roles: ["admin"] },
  { label: "Seguimiento", href: "/dashboard/tracking", icon: Waypoints, roles: ["admin", "contact_manager"] },
  { label: "Configuración", href: "/dashboard/settings", icon: UserRoundCog, roles: ["admin"] },
];

export function navigationForRole(role: UserRole) {
  return dashboardNavigation.filter((item) => item.roles.includes(role));
}
