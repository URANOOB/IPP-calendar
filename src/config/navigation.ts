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
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Contactos", href: "/dashboard/contacts", icon: Users, roles: ["admin"] },
  { label: "Estudiantes", href: "/dashboard/students", icon: GraduationCap, roles: ["admin"] },
  { label: "Profesores", href: "/dashboard/teachers", icon: UserRoundCog, roles: ["admin"] },
  { label: "Clases", href: "/dashboard/classes", icon: BookOpenCheck, roles: ["admin"] },
  { label: "Ciclos", href: "/dashboard/cycles", icon: CalendarDays, roles: ["admin"] },
  { label: "Seguimiento", href: "/dashboard/tracking", icon: Waypoints, roles: ["admin"] },
];

export function navigationForRole(role: UserRole) {
  return dashboardNavigation.filter((item) => item.roles.includes(role));
}
