import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, CalendarDays, GraduationCap, LayoutDashboard, Users, UserRoundCog, Waypoints } from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const dashboardNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Contactos", href: "/dashboard/contactos", icon: Users },
  { label: "Estudiantes", href: "/dashboard/estudiantes", icon: GraduationCap },
  { label: "Profesores", href: "/dashboard/profesores", icon: UserRoundCog },
  { label: "Clases", href: "/dashboard/clases", icon: BookOpenCheck },
  { label: "Ciclos", href: "/dashboard/ciclos", icon: CalendarDays },
  { label: "Seguimiento", href: "/dashboard/seguimiento", icon: Waypoints },
];
