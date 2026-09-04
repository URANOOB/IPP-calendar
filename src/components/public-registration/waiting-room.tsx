"use client";

import { CalendarDays, Clock3, ExternalLink, GraduationCap, Video } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { getPublicMeetingAccess } from "@/app/clases/t/[token]/actions";
import { Button } from "@/components/ui/button";
import { canShowMeetingLink, getPublicClassState } from "@/lib/classes/waiting-room";
import { formatBogotaDate } from "@/lib/cycles/dates";

export interface WaitingRoomClass { studentId: string; studentName: string; classId: string; title: string; teacherName: string; startsAt: string; endsAt: string; status: string; }
const time = (value: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function Countdown({ startsAt, now }: { startsAt: string; now: Date }) {
  const totalSeconds = Math.max(0, Math.floor((new Date(startsAt).getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const units = [
    { value: days, label: days === 1 ? "día" : "días" },
    { value: Math.floor((totalSeconds % 86400) / 3600), label: "horas" },
    { value: Math.floor((totalSeconds % 3600) / 60), label: "min" },
    { value: totalSeconds % 60, label: "seg" },
  ];
  return <div><p className="mb-3 text-sm font-semibold">Tu clase comienza en</p><div role="timer" aria-label="Tiempo restante para la clase" aria-live="off" className="grid grid-cols-4 gap-2">{units.map(({ value, label }) => <div key={label} className="min-w-0 rounded-xl border border-primary/10 bg-card px-1 py-3 text-center"><span className="block text-2xl font-bold tabular-nums tracking-tight text-primary">{String(value).padStart(2, "0")}</span><span className="mt-1 block text-xs text-muted-foreground">{label}</span></div>)}</div></div>;
}

export function WaitingRoom({ token, classes, serverNow }: Readonly<{ token: string; classes: WaitingRoomClass[]; serverNow: string }>) {
  if (classes.length === 0) return null;
  return <section aria-labelledby="my-classes-heading" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="my-classes-heading" className="text-2xl font-bold">Mis clases</h2><p className="mt-1 text-sm text-muted-foreground">Revisa cada inscripción y entra a la clase cuando sea el momento.</p></div><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />Hora de Bogotá</span></div><div className="space-y-4">{classes.map((classItem) => <WaitingRoomCard classItem={classItem} key={`${classItem.studentId}-${classItem.classId}`} serverNow={serverNow} token={token} />)}</div></section>;
}

function WaitingRoomCard({ token, classItem, serverNow }: { token: string; classItem: WaitingRoomClass; serverNow: string }) {
  const [now, setNow] = useState(() => new Date(serverNow));
  const [meetingUrl, setMeetingUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const requested = useRef(false);
  const state = getPublicClassState(classItem, now);
  const showMeeting = canShowMeetingLink(classItem, now);
  useEffect(() => {
    const loadedAt = Date.now();
    const serverTime = new Date(serverNow).getTime();
    const timer = window.setInterval(() => setNow(new Date(serverTime + Date.now() - loadedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);
  useEffect(() => { if (!showMeeting || requested.current) return; requested.current = true; startTransition(async () => { const result = await getPublicMeetingAccess(token, classItem.studentId, classItem.classId); if (result.success) setMeetingUrl(result.meetingUrl); else setError(result.error); }); }, [classItem.classId, classItem.studentId, showMeeting, token]);
  const statusLabel = state === "cancelled" ? "Cancelada" : state === "finished" ? "Finalizada" : state === "live" ? "En curso" : state === "starting_soon" ? "Comienza pronto" : "Programada";
  const message = state === "cancelled" ? "Esta clase fue cancelada." : state === "finished" ? "Esta clase ya finalizó." : state === "live" ? "Tu clase ya comenzó. Puedes ingresar desde aquí." : "El botón para entrar se habilita 30 minutos antes de la clase.";
  return <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6"><p className="flex min-w-0 items-center gap-2 font-semibold"><GraduationCap aria-hidden="true" className="size-5 shrink-0 text-primary" /><span className="min-w-0 break-words">{classItem.studentName}</span></p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${state === "cancelled" ? "bg-rose-50 text-rose-700" : state === "finished" ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-700"}`}>{statusLabel}</span></div>
    <div className="grid md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 px-5 py-6 sm:px-6"><h3 className="break-words text-2xl font-bold">{classItem.title}</h3><p className="mt-2 break-words text-sm text-muted-foreground">Con <span className="font-medium text-foreground">{classItem.teacherName}</span></p><dl className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><div className="flex items-start gap-2.5"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs text-muted-foreground">Fecha</dt><dd className="mt-1 text-sm font-medium"><time dateTime={classItem.startsAt}>{formatBogotaDate(classItem.startsAt)}</time></dd></div></div><div className="flex items-start gap-2.5"><Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs text-muted-foreground">Horario</dt><dd className="mt-1 text-sm font-medium">{time(classItem.startsAt)} – {formatBogotaDate(classItem.startsAt) !== formatBogotaDate(classItem.endsAt) ? `${formatBogotaDate(classItem.endsAt)}, ` : ""}{time(classItem.endsAt)}</dd></div></div></dl></div>
      <div className="flex flex-col justify-center border-t bg-secondary/35 px-5 py-6 sm:px-6 md:border-l md:border-t-0">
        {state === "upcoming" || state === "starting_soon" ? <Countdown now={now} startsAt={classItem.startsAt} /> : <p className="flex items-center gap-2 font-semibold"><Video aria-hidden="true" className="size-5 text-primary" />{statusLabel}</p>}
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{showMeeting ? state === "live" ? message : "Ya puedes entrar y esperar el inicio de tu clase." : message}</p>
        {showMeeting ? <div className="mt-4">{meetingUrl ? <Button asChild className="h-12 w-full"><a href={meetingUrl} rel="noreferrer" target="_blank"><Video aria-hidden="true" />Entrar a la clase<ExternalLink aria-hidden="true" /></a></Button> : <p className="text-sm text-muted-foreground" role={error ? "alert" : "status"}>{pending ? "Preparando acceso…" : error ?? "El enlace no está disponible todavía."}</p>}</div> : null}
      </div>
    </div>
  </article>;
}
