export type UserRole = "admin";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole;
}
