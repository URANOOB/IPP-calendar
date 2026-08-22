export type UserRole = "admin" | "manager";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole;
}
