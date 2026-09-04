"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bell, Inbox, LoaderCircle, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { clearPlatformActivity, deletePlatformActivity } from "@/app/(dashboard)/dashboard/platform-actions";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import type { PlatformActivity } from "@/lib/platform-activity/service";

const entityLabels: Record<string, string> = {
  classes: "clase",
  contact_events: "actividad de seguimiento",
  guardians: "acudiente",
  registrations: "inscripción",
  students: "estudiante",
  teachers: "profesor",
  weekly_cycles: "ciclo",
};

function activityText(activity: PlatformActivity) {
  if (activity.entityType === "contact_events") {
    const eventType = typeof activity.metadata === "object" && activity.metadata && !Array.isArray(activity.metadata) ? activity.metadata.event_type : undefined;
    const eventLabels: Record<string, string> = { attendance_updated: "Se actualizó una asistencia", booking_created: "Se creó una inscripción", contacted: "Se registró un contacto", invitation_sent: "Se envió una invitación", manager_assigned: "Se asignó un responsable", note_added: "Se agregó una nota", registered_from_form: "Se recibió un registro público", response_updated: "Se actualizó una respuesta", whatsapp_opened: "Se abrió WhatsApp" };
    return typeof eventType === "string" ? eventLabels[eventType] ?? "Se registró una actividad" : "Se registró una actividad";
  }
  const verb = activity.action === "created" ? "Se creó" : activity.action === "updated" ? "Se actualizó" : "Se eliminó";
  return `${verb} ${entityLabels[activity.entityType] ?? "un registro"}: ${activity.subject}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(value));
}

export function NotificationCenter({ initialActivity, canManage }: Readonly<{ initialActivity: PlatformActivity[]; canManage: boolean }>) {
  const [open, setOpen] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [clearedThrough, setClearedThrough] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirmation();
  const activity = initialActivity.filter((item) => !removedIds.includes(item.id) && (!clearedThrough || new Date(item.createdAt) > new Date(clearedThrough)));

  function remove(activityId: string) {
    setError(undefined);
    setPendingId(activityId);
    startTransition(async () => {
      try {
        const result = await deletePlatformActivity(activityId);
        if (result.success) setRemovedIds((current) => [...current, activityId]);
        else setError(result.error ?? "No se pudo eliminar la notificación.");
      } catch { setError("No se pudo eliminar la notificación. Intenta nuevamente."); }
      finally { setPendingId(undefined); }
    });
  }

  async function clearAll() {
    const latest = activity[0]?.createdAt;
    if (!latest) return;
    setOpen(false);
    const accepted = await confirm({ title: "Limpiar todas las notificaciones", description: "Se eliminará la actividad anterior de este panel compartido, incluidas las notificaciones más antiguas. Los contactos, clases e inscripciones se conservarán.", confirmLabel: "Limpiar todas" });
    setOpen(true);
    if (!accepted) return;
    setError(undefined);
    setPendingId("all");
    startTransition(async () => {
      try {
        const result = await clearPlatformActivity(latest);
        if (result.success) setClearedThrough(latest);
        else setError(result.error ?? "No se pudieron limpiar las notificaciones.");
      } catch { setError("No se pudieron limpiar las notificaciones. Intenta nuevamente."); }
      finally { setPendingId(undefined); }
    });
  }

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><Button aria-label="Abrir notificaciones" className="relative bg-muted/70 text-sky-600 hover:bg-secondary hover:text-primary" size="icon" title="Notificaciones" type="button" variant="ghost"><Bell aria-hidden="true" />{activity.length ? <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500" /> : null}</Button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="end" sideOffset={12} collisionPadding={16} aria-label="Notificaciones" className="z-50 flex max-h-[min(38rem,var(--radix-popover-content-available-height))] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_rgba(37,61,104,0.22)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-bold">Actividad reciente</h2><p className="mt-1 text-xs text-muted-foreground">Novedades de la plataforma · Hora de Bogotá</p></div><Popover.Close asChild><Button aria-label="Cerrar notificaciones" size="icon" title="Cerrar" type="button" variant="ghost"><X aria-hidden="true" /></Button></Popover.Close></header>
      {error ? <p className="m-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
      <div className="min-h-0 overflow-y-auto p-2" aria-busy={isPending}>
        {activity.length === 0 ? <div className="grid place-items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground" role="status"><Inbox aria-hidden="true" className="size-8 text-sky-400" /><p className="font-medium text-foreground">Estás al día</p><p>No hay notificaciones pendientes.</p></div> : activity.map((item) => <article className="group flex gap-3 rounded-xl px-3 py-3 hover:bg-muted/70" key={item.id}><span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-400" /><div className="min-w-0 flex-1"><p className="break-words text-sm leading-5 text-foreground">{activityText(item)}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></div>{canManage ? <Button aria-label={`Eliminar notificación: ${activityText(item)}`} className="shrink-0 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" disabled={isPending} onClick={() => remove(item.id)} size="icon" title="Eliminar notificación" type="button" variant="ghost">{pendingId === item.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}</Button> : null}</article>)}
      </div>
      {canManage ? <footer className="shrink-0 border-t bg-background/50 px-4 py-3"><Button className="h-auto min-h-11 w-full whitespace-normal" disabled={isPending || activity.length === 0} onClick={() => void clearAll()} type="button" variant="outline">{pendingId === "all" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}{pendingId === "all" ? "Limpiando…" : "Limpiar todas las notificaciones"}</Button></footer> : null}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
