"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Video } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MeetingLink({ url }: Readonly<{ url: string }>) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setError(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(true);
    }
  }

  return <div className="space-y-2">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3"><Video aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm font-semibold">Enlace de la clase</p><a className="mt-1 block truncate text-xs text-muted-foreground hover:text-primary hover:underline" href={url} rel="noopener noreferrer" target="_blank" title={url}>{url}</a></div></div>
      <div className="flex flex-wrap gap-2"><Button asChild><a href={url} rel="noopener noreferrer" target="_blank"><ExternalLink aria-hidden="true" />Abrir reunión<span className="sr-only"> (nueva pestaña)</span></a></Button><Button onClick={() => void copy()} type="button" variant="outline">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? "Copiado" : "Copiar enlace"}</span></Button></div>
    </div>
    {error ? <p className="text-xs text-rose-600" role="alert">No se pudo copiar. Selecciona el enlace y cópialo manualmente.</p> : null}
  </div>;
}
