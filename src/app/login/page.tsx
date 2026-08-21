import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/login/sign-in-form";
import { getAuthState } from "@/lib/auth/user";

export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  const auth = await getAuthState();

  if (auth.kind === "authenticated") {
    redirect("/dashboard");
  }

  if (auth.kind !== "anonymous") {
    redirect("/unauthorized");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <ShieldCheck aria-hidden="true" className="mb-5 size-9 text-primary" />
        <h1 className="text-2xl font-bold">Acceso del equipo</h1>
        <p className="mt-3 leading-6 text-muted-foreground">Ingresa con las credenciales asignadas por la administración de IPP.</p>
        <SignInForm />
      </section>
    </main>
  );
}
