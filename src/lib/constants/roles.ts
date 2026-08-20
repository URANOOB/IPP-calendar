import type { UserRole } from "@/types/user";

export const USER_ROLES: readonly UserRole[] = ["admin", "teacher", "contact_manager"];

/** Future home routes for each authenticated staff role. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  admin: "/admin",
  teacher: "/teacher",
  contact_manager: "/contact-manager",
};
