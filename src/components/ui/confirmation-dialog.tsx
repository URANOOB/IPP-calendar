"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "destructive" | "warning";
}

type Confirm = (options: ConfirmationOptions) => Promise<boolean>;
const ConfirmationContext = createContext<Confirm | null>(null);

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required.");
  return confirm;
}

export function ConfirmationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const id = useId();

  const confirm = useCallback<Confirm>((options) => {
    // Ignore a second request while a decision is already open.
    if (resolver.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setRequest(options);
    });
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    dialog.current?.close();
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  useEffect(() => {
    if (!request) return;
    dialog.current?.showModal();
    cancelButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [request]);

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  const destructive = request?.variant !== "warning";
  return <ConfirmationContext.Provider value={confirm}>
    {children}
    <dialog ref={dialog} role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); finish(false); }} onClose={() => { if (resolver.current) finish(false); }} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm">
      {request ? <>
        <div className="p-6 sm:p-7">
          <div className={`mb-4 flex size-12 items-center justify-center rounded-2xl ${destructive ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"}`}>{destructive ? <Trash2 aria-hidden="true" className="size-6" /> : <AlertTriangle aria-hidden="true" className="size-6" />}</div>
          <h2 id={`${id}-title`} className="break-words text-xl font-bold">{request.title}</h2>
          <p id={`${id}-description`} className="mt-3 break-words text-sm leading-6 text-muted-foreground">{request.description}</p>
          {destructive ? <p className="mt-4 text-sm font-medium text-rose-600">Esta acción no se puede deshacer.</p> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t bg-background/60 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button ref={cancelButton} className={`${buttonVariants({ variant: "outline" })} h-11`} onClick={() => finish(false)} type="button">Cancelar</button>
          <Button className={`h-11 ${destructive ? "bg-rose-600 text-white hover:bg-rose-700" : ""}`} onClick={() => finish(true)} type="button" variant={destructive ? "destructive" : "default"}>{request.confirmLabel}</Button>
        </div>
      </> : null}
    </dialog>
  </ConfirmationContext.Provider>;
}
