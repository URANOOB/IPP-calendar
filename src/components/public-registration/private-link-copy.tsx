"use client";

import { Check, ChevronDown, Copy, Link2, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function PrivateLinkCopy({ token, origin }: Readonly<{ token: string; origin: string }>) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const link = `${origin}/clases/t/${token}`;
  async function copy() {
    setError(false);
    try { await navigator.clipboard.writeText(link); }
    catch { setError(true); setShowLink(true); return; }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <section className="rounded-2xl border bg-card px-5 py-4 sm:px-6" aria-labelledby="private-link-heading">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><LockKeyhole aria-hidden="true" className="size-5" /></span><div><h2 id="private-link-heading" className="font-semibold">Tu enlace privado</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Guárdalo para volver a este espacio y entrar a tus clases.</p></div></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2"><Button className="h-11" onClick={() => void copy()} type="button" variant="outline">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? "Copiado" : "Copiar enlace"}</span></Button><button aria-expanded={showLink} aria-controls="private-link-value" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-primary" onClick={() => setShowLink((visible) => !visible)} type="button">{showLink ? "Ocultar" : "Ver enlace"}<ChevronDown aria-hidden="true" className={`size-4 ${showLink ? "rotate-180" : ""}`} /></button></div>
    </div>
    <div id="private-link-value" hidden={!showLink} className="mt-4 border-t pt-4"><label htmlFor="private-link-input" className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Link2 aria-hidden="true" className="size-4" />Este enlace es personal. Conserva una copia.</label><input id="private-link-input" aria-label="Tu enlace privado" className="h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm" onFocus={(event) => event.target.select()} readOnly value={link} /></div>
    {error ? <p className="mt-3 text-sm text-rose-600" role="alert">No se pudo copiar. Selecciona el enlace y cópialo manualmente.</p> : null}
  </section>;
}
