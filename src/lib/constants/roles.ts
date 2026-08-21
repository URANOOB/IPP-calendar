import type { UserRole } from "@/types/user";

export const USER_ROLES: readonly UserRole[] = ["admin", "teacher", "contact_manager"];

/** Future home routes for each authenticated staff role. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  admin: "/dashboard",
  teacher: "/dashboard",
  contact_manager: "/dashboard",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  teacher: "Profesor",
  contact_manager: "Gestor de contactos",
};
