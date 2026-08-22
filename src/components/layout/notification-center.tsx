"use client";

import { Bell, Inbox, LoaderCircle, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { deletePlatformActivity } from "@/app/(dashboard)/dashboard/platform-actions";
import { Button } from "@/components/ui/button";
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
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NotificationCenter({ initialActivity }: Readonly<{ initialActivity: PlatformActivity[] }>) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState(initialActivity);
  const [isPending, startTransition] = useTransition();

  function remove(activityId: string) {
    startTransition(async () => {
      const result = await deletePlatformActivity(activityId);
      if (result.success) setActivity((current) => current.filter((item) => item.id !== activityId));
    });
  }

  return <>
    <Button aria-expanded={open} aria-haspopup="dialog" aria-label="Abrir notificaciones" className="relative bg-muted/70 text-sky-600 hover:bg-secondary hover:text-primary" onClick={() => setOpen((current) => !current)} size="icon" title="Notificaciones" type="button" variant="ghost"><Bell aria-hidden="true" />{activity.length ? <i className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500" /> : null}</Button>
    {open ? <>
      <button aria-label="Cerrar notificaciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} type="button" />
      <section aria-label="Notificaciones" aria-modal="true" className="fixed right-4 top-24 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_rgba(37,61,104,0.22)] sm:right-7" role="dialog">
        <header className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="font-bold">Actividad reciente</h2><p className="text-xs text-muted-foreground">Registro de lo que ocurre en la plataforma</p></div><Button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} size="icon" title="Cerrar" type="button" variant="ghost"><X aria-hidden="true" /></Button></header>
        <div className="max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto p-2">
          {activity.length === 0 ? <div className="grid place-items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"><Inbox aria-hidden="true" className="size-8 text-sky-400" />No hay notificaciones pendientes.</div> : activity.map((item) => <article className="group flex gap-3 rounded-xl px-3 py-3 hover:bg-muted/70" key={item.id}><span className="mt-1 size-2 shrink-0 rounded-full bg-cyan-400" /><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-foreground">{activityText(item)}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></div><Button aria-label={`Eliminar notificación: ${activityText(item)}`} className="shrink-0 bg-transparent text-muted-foreground opacity-100 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" disabled={isPending} onClick={() => remove(item.id)} size="icon" title="Eliminar notificación" type="button" variant="ghost">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}</Button></article>)}
        </div>
      </section>
    </> : null}
  </>;
}
