"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <section className="rounded-xl border bg-card p-6" role="alert">
    <h1 className="text-xl font-bold">No pudimos cargar esta sección</h1>
    <p className="my-3 text-sm text-muted-foreground">Revisa tu conexión e inténtalo nuevamente. Si el problema continúa, contacta al administrador.</p>
    <Button onClick={reset} type="button">Intentar de nuevo</Button>
  </section>;
}
