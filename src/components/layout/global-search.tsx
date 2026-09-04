"use client";

import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, LoaderCircle, Search, SearchX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { searchPlatform, type PlatformSearchResult } from "@/app/(dashboard)/dashboard/platform-actions";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<{ query: string; results: PlatformSearchResult[]; error?: string }>({ query: "", results: [] });
  const input = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const pending = term.length >= 2 && response.query !== term;
  const results = response.query === term ? response.results : [];

  useEffect(() => {
    if (!open || term.length < 2) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchPlatform(term);
        if (!cancelled) setResponse({ query: term, results });
      } catch {
        if (!cancelled) setResponse({ query: term, results: [], error: "No se pudo completar la búsqueda. Intenta nuevamente." });
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [open, term]);

  function changeOpen(value: boolean) {
    setOpen(value);
    if (!value) { setQuery(""); setResponse({ query: "", results: [] }); }
  }

  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger asChild><Button aria-label="Abrir búsqueda" className="bg-muted/70 text-muted-foreground hover:bg-secondary hover:text-primary" size="icon" title="Buscar en la plataforma" type="button" variant="ghost"><Search aria-hidden="true" /></Button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="end" sideOffset={12} collisionPadding={16} onOpenAutoFocus={(event) => { event.preventDefault(); input.current?.focus(); }} aria-label="Búsqueda global" className="z-50 flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_rgba(37,61,104,0.22)]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4"><h2 className="font-bold">Buscar en la plataforma</h2><Popover.Close asChild><Button aria-label="Cerrar búsqueda" size="icon" type="button" variant="ghost"><X aria-hidden="true" /></Button></Popover.Close></header>
      <div className="shrink-0 px-5 pb-4 pt-2"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><input ref={input} type="text" autoComplete="off" aria-label="Buscar nombres, teléfonos o clases" aria-describedby="global-search-help" className="h-11 w-full min-w-0 rounded-xl border bg-background pl-10 pr-12 text-sm" placeholder="Nombre, teléfono o clase…" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <Button aria-label="Limpiar búsqueda" className="absolute right-0.5 top-0.5" onClick={() => { setQuery(""); input.current?.focus(); }} size="icon" type="button" variant="ghost"><X aria-hidden="true" /></Button> : null}</div><p id="global-search-help" className="mt-2 text-xs leading-5 text-muted-foreground">Contactos, estudiantes, profesores, clases y ciclos.</p></div>
      <div className="min-h-0 overflow-y-auto border-t p-2" aria-busy={pending}>
        {term.length < 2 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Escribe al menos dos caracteres para buscar.</p> : pending ? <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Buscando…</p> : response.error ? <p className="px-3 py-6 text-sm text-destructive" role="alert">{response.error}</p> : results.length ? <><p className="px-3 py-2 text-xs text-muted-foreground" role="status">{results.length} {results.length === 1 ? "resultado" : "resultados"}</p><ul>{results.map((result) => <li key={`${result.type}-${result.id}`}><Link href={result.href} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted focus-visible:bg-muted" onClick={() => changeOpen(false)}><div className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{result.label}</span><span className="mt-0.5 block break-words text-xs text-muted-foreground">{result.description}</span></div><span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs text-primary">{result.type}</span><ArrowUpRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" /></Link></li>)}</ul></> : <div className="px-3 py-6 text-center text-sm text-muted-foreground" role="status"><SearchX aria-hidden="true" className="mx-auto mb-2 size-6" /><p className="break-words">No encontramos resultados para “{term}”.</p></div>}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
