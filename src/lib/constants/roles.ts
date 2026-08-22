import type { UserRole } from "@/types/user";

export const USER_ROLES: readonly UserRole[] = ["admin"];

/** Future home routes for each authenticated staff role. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  admin: "/dashboard",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
};
