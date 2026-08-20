export type UserRole = "admin" | "teacher" | "contact_manager";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole;
}
