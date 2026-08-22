"use client";

import { ExternalLink, Video } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { getPublicMeetingAccess } from "@/app/clases/t/[token]/actions";
import { Button } from "@/components/ui/button";
import { canShowMeetingLink, getPublicClassState } from "@/lib/classes/waiting-room";
import { formatBogotaDate } from "@/lib/cycles/dates";

export interface WaitingRoomClass { studentId: string; studentName: string; classId: string; title: string; teacherName: string; startsAt: string; endsAt: string; status: string; }
const time = (value: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function Countdown({ startsAt, serverNow }: { startsAt: string; serverNow: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(startsAt).getTime() - new Date(serverNow).getTime()));
  useEffect(() => { const loadedAt = Date.now(); const serverTime = new Date(serverNow).getTime(); const update = () => setRemaining(Math.max(0, new Date(startsAt).getTime() - (serverTime + Date.now() - loadedAt))); update(); const interval = window.setInterval(update, 1000); return () => window.clearInterval(interval); }, [serverNow, startsAt]);
  const totalSeconds = Math.floor(remaining / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
  return <p className="mt-3 text-lg font-bold text-primary" aria-live="polite">Comienza en: {days > 0 ? `${String(days).padStart(2, "0")} días · ` : ""}{String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</p>;
}

export function WaitingRoom({ token, classes, serverNow }: Readonly<{ token: string; classes: WaitingRoomClass[]; serverNow: string }>) {
  if (classes.length === 0) return null;
  return <section className="mb-8"><h2 className="text-3xl font-bold">Mis clases</h2><p className="mt-2 text-lg text-muted-foreground">Aquí encontrarás la información de las próximas clases de tus niños.</p><div className="mt-5 space-y-4">{classes.map((classItem) => <WaitingRoomCard classItem={classItem} key={`${classItem.studentId}-${classItem.classId}`} serverNow={serverNow} token={token} />)}</div></section>;
}

function WaitingRoomCard({ token, classItem, serverNow }: { token: string; classItem: WaitingRoomClass; serverNow: string }) {
  const [now, setNow] = useState(() => new Date(serverNow)); const [meetingUrl, setMeetingUrl] = useState<string>(); const [error, setError] = useState<string>(); const [pending, startTransition] = useTransition(); const requested = useRef(false);
  const state = getPublicClassState(classItem, now); const showMeeting = canShowMeetingLink(classItem, now);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!showMeeting || requested.current) return; requested.current = true; startTransition(async () => { const result = await getPublicMeetingAccess(token, classItem.studentId, classItem.classId); if (result.success) setMeetingUrl(result.meetingUrl); else setError(result.error); }); }, [classItem.classId, classItem.studentId, showMeeting, token]);
  const message = state === "cancelled" ? "Esta clase fue cancelada." : state === "finished" ? "Esta clase ya finalizó." : state === "live" ? "La clase está lista para ingresar." : state === "starting_soon" ? "Tu clase comenzará pronto." : "El enlace estará disponible 30 minutos antes.";
  return <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><p className="text-xl font-bold">{classItem.studentName}</p><h3 className="mt-3 text-2xl font-bold">{classItem.title}</h3><p className="mt-1 text-lg">Prof. {classItem.teacherName}</p><p className="mt-3 text-lg text-muted-foreground">{formatBogotaDate(classItem.startsAt)}<br />{time(classItem.startsAt)} – {time(classItem.endsAt)}</p>{state === "upcoming" || state === "starting_soon" ? <Countdown serverNow={serverNow} startsAt={classItem.startsAt} /> : <p className={`mt-3 text-lg font-bold ${state === "live" ? "text-primary" : "text-muted-foreground"}`}>{message}</p>}{showMeeting ? <div className="mt-5">{meetingUrl ? <Button asChild className="h-13 w-full text-lg sm:w-auto sm:px-7"><a href={meetingUrl} rel="noreferrer" target="_blank"><Video />Entrar a la clase<ExternalLink /></a></Button> : <p className="text-base text-muted-foreground">{pending ? "Preparando acceso…" : error ?? "El enlace no está disponible todavía."}</p>}</div> : null}</article>;
}
