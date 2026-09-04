import { ShieldAlert } from "lucide-react";

import { signOut } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Acceso denegado" };

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <ShieldAlert aria-hidden="true" className="mb-5 size-9 text-destructive" />
        <h1 className="text-2xl font-bold">No tienes acceso</h1>
        <p className="mt-3 leading-6 text-muted-foreground">No tienes permisos para acceder a esta sección. Si tu cuenta acaba de ser restaurada, vuelve al acceso para renovar la sesión.</p>
        <form action={signOut} className="mt-8">
          <Button type="submit" variant="outline">Volver al acceso</Button>
        </form>
      </section>
    </main>
  );
}
