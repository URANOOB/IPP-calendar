import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Acceso" };

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <ShieldCheck aria-hidden="true" className="mb-5 size-9 text-primary" />
        <h1 className="text-2xl font-bold">Acceso del equipo</h1>
        <p className="mt-3 leading-6 text-muted-foreground">
          La pantalla de autenticación se conectará a Supabase Auth en una tarea posterior.
        </p>
        <Button asChild className="mt-8" variant="outline">
          <Link href="/">
            <ArrowLeft aria-hidden="true" /> Volver al inicio
          </Link>
        </Button>
      </section>
    </main>
  );
}
