import { cache } from "react";
import { redirect } from "next/navigation";

import { USER_ROLES } from "@/lib/constants/roles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/user";

export interface StaffProfile {
  id: string;
  fullName: string;
  role: UserRole;
}

export interface InternalUser extends StaffProfile {
  email: string | null;
}

type AuthState =
  | { kind: "anonymous" }
  | { kind: "missing_profile" | "inactive_profile" | "invalid_role" }
  | { kind: "authenticated"; user: InternalUser };

function isUserRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role);
}

/**
 * Resolves the verified Supabase identity and its database-backed staff profile.
 * React request caching prevents duplicate profile lookups from a layout and page.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claimsError || !claims?.sub) {
    return { kind: "anonymous" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profileError) {
    console.error("No fue posible consultar el perfil interno.", profileError);
    return { kind: "missing_profile" };
  }

  if (!profile) {
    return { kind: "missing_profile" };
  }

  if (!profile.active) {
    return { kind: "inactive_profile" };
  }

  if (!isUserRole(profile.role)) {
    console.error("Perfil interno con rol no reconocido.", { profileId: profile.id, role: profile.role });
    return { kind: "invalid_role" };
  }

  return {
    kind: "authenticated",
    user: {
      id: profile.id,
      email: typeof claims.email === "string" ? claims.email : null,
      fullName: profile.full_name,
      role: profile.role,
    },
  };
});

/** Requires a valid, active internal profile; it never trusts browser-provided roles. */
export async function requireUser(): Promise<InternalUser> {
  const auth = await getAuthState();

  if (auth.kind === "anonymous") {
    redirect("/login");
  }

  if (auth.kind !== "authenticated") {
    redirect("/unauthorized");
  }

  return auth.user;
}

export async function requireAnyRole(roles: readonly UserRole[]): Promise<InternalUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

export async function requireRole(role: UserRole): Promise<InternalUser> {
  return requireAnyRole([role]);
}
