"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function PrivateLinkCopy({ token, origin }: Readonly<{ token: string; origin: string }>) {
  const [copied, setCopied] = useState(false);
  const link = `${origin}/clases/t/${token}`;
  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <section className="mb-6 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-lg font-bold">Tu enlace privado</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Guárdalo para volver a tus clases, revisar tus inscripciones y entrar a la sala de espera.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Tu enlace privado" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" readOnly value={link} /><Button onClick={() => void copy()} type="button" variant="outline">{copied ? "Copiado" : "Copiar enlace"}</Button></div></section>;
}
