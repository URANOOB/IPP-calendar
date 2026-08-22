"use client";

import Link from "next/link";
import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchPlatform, type PlatformSearchResult } from "@/app/(dashboard)/dashboard/platform-actions";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlatformSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const timeout = window.setTimeout(() => {
      startTransition(async () => setResults(await searchPlatform(trimmed)));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return <>
    <Button aria-expanded={open} aria-haspopup="dialog" aria-label="Buscar en la plataforma" className="bg-muted/70 text-sky-600 hover:bg-secondary hover:text-primary" onClick={() => setOpen(true)} size="icon" title="Buscar" type="button" variant="ghost"><Search aria-hidden="true" /></Button>
    {open ? <>
      <button aria-label="Cerrar búsqueda" className="fixed inset-0 z-40 cursor-default bg-slate-950/15" onClick={close} type="button" />
      <section aria-label="Búsqueda global" aria-modal="true" className="fixed left-4 right-4 top-24 z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_rgba(37,61,104,0.22)] sm:left-auto sm:right-7" role="dialog">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search aria-hidden="true" className="size-5 text-primary" />
          <input aria-label="Buscar nombres, clases, ciclos o profesores" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombres, clases, ciclos o profesores…" ref={inputRef} value={query} />
          {isPending ? <LoaderCircle aria-label="Buscando" className="size-4 animate-spin text-muted-foreground" /> : null}
          <Button aria-label="Cerrar búsqueda" onClick={close} size="icon" title="Cerrar" type="button" variant="ghost"><X aria-hidden="true" /></Button>
        </div>
        <div className="max-h-[min(26rem,calc(100vh-9rem))] overflow-y-auto p-2">
          {query.trim().length < 2 ? <p className="px-3 py-5 text-sm text-muted-foreground">Escribe al menos dos caracteres para buscar en toda la plataforma.</p> : null}
          {query.trim().length >= 2 && !isPending && results.length === 0 ? <p className="px-3 py-5 text-sm text-muted-foreground">No encontramos resultados para “{query}”.</p> : null}
          {results.map((result) => <Link className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-secondary" href={result.href} key={`${result.type}-${result.id}`} onClick={close}>
            <span className="min-w-0"><strong className="block truncate text-sm text-foreground">{result.label}</strong><small className="block truncate text-muted-foreground">{result.description}</small></span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{result.type}</span>
          </Link>)}
        </div>
      </section>
    </> : null}
  </>;
}
