"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { BellRing, ChevronDown } from "lucide-react";

import { addContactNote, recordWhatsAppOpened, updateClassReminderSettings, updateContactResponse } from "@/app/(dashboard)/dashboard/tracking/actions";
import { Button } from "@/components/ui/button";
import { formatColombianPhone } from "@/lib/utils/phone";

export interface TrackingEvent {
  id: string;
  eventType: "contacted" | "invitation_sent" | "response_updated" | "booking_created" | "whatsapp_opened" | "attendance_updated" | "note_added" | "manager_assigned" | "registered_from_form";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TrackingRow {
  guardianId: string;
  guardianName: string;
  phone: string;
  students: string[];
  firstContactAt: string | null;
  response: string;
  booked: boolean;
  enrolledCount: number;
  nextClass: string | null;
  registeredFromPublicAt: string | null;
  lastUpdatedAt: string | null;
  lastUpdateChannel: string | null;
  events: TrackingEvent[];
}

export interface ClassReminderSettings {
  firstEnabled: boolean;
  firstLeadMinutes: number;
  secondEnabled: boolean;
  secondLeadMinutes: number;
}

const responseLabel: Record<string, string> = { not_contacted: "Pendiente", contacted: "Contactado", no_response: "Sin respuesta", interested: "Interesado", declined: "No interesado", booked: "Agendado", registered: "Registrado" };
const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const reminderLeadOptions = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440];

function reminderLeadLabel(minutes: number) {
  if (minutes === 1440) return "24 horas antes";
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"} antes`;
  return `${minutes} minutos antes`;
}

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Sin actualizaciones";
}

function eventChannel(eventType: TrackingEvent["eventType"]) {
  if (eventType === "whatsapp_opened") return "WhatsApp";
  if (eventType === "registered_from_form") return "Formulario";
  if (eventType === "booking_created" || eventType === "attendance_updated") return "Sistema";
  return "Seguimiento";
}

function formatLastUpdate(row: TrackingRow) {
  return row.lastUpdatedAt ? `${row.lastUpdateChannel ?? "Seguimiento"} · ${formatDateTime(row.lastUpdatedAt)}` : "Sin actualizaciones";
}

function eventDescription(event: TrackingEvent) {
  const response = typeof event.metadata.response === "string" ? event.metadata.response : undefined;
  const note = typeof event.metadata.note === "string" ? event.metadata.note : undefined;
  const attendance = typeof event.metadata.status === "string" ? event.metadata.status : undefined;
  const labels: Record<TrackingEvent["eventType"], string> = {
    contacted: "Se marcó el contacto con el acudiente.",
    invitation_sent: "Se envió la invitación.",
    response_updated: `Se actualizó la respuesta a: ${responseLabel[response ?? ""] ?? "Sin respuesta"}.`,
    booking_created: "Se programó una clase.",
    whatsapp_opened: "Se abrió WhatsApp para contactar al acudiente.",
    attendance_updated: `Se registró asistencia: ${attendance === "attended" ? "asistió" : attendance === "absent" ? "no asistió" : "actualizada"}.`,
    note_added: note ? `Se agregó una nota: ${note}` : "Se agregó una nota.",
    manager_assigned: "Se actualizó el responsable.",
    registered_from_form: "El acudiente se registró directamente desde el formulario.",
  };
  return labels[event.eventType];
}

function trackingStatus(row: TrackingRow) {
  if (row.booked) return "booked";
  if (row.registeredFromPublicAt) return "registered";
  return row.response === "booked" ? "contacted" : row.response;
}

export function TrackingManager({ reminderSettings: initialReminderSettings, rows }: { reminderSettings: ClassReminderSettings; rows: TrackingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [response, setResponse] = useState("all");
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [reminderSettings, setReminderSettings] = useState(initialReminderSettings);
  const visible = rows.filter((row) => (response === "all" || trackingStatus(row) === response) && `${row.guardianName} ${row.phone} ${row.students.join(" ")}`.toLowerCase().includes(filter.toLowerCase()));
  const selectedRow = visible.find((row) => row.guardianId === selectedGuardianId);

  function toggleGuardian(guardianId: string) {
    setError(undefined);
    setSelectedGuardianId((current) => current === guardianId ? undefined : guardianId);
  }

  function closeDetail(guardianId: string) {
    setSelectedGuardianId(undefined);
    setError(undefined);
    document.getElementById(`tracking-toggle-${guardianId}`)?.focus();
  }

  function execute(task: () => Promise<{ success: boolean; error?: string }>, onSuccess?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (!result.success) {
        setError(result.error ?? "No pudimos actualizar el seguimiento.");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  return <div className="space-y-4">
    <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">Configurar recordatorios a profesores</summary><div className="mt-4"><ReminderSettingsPanel disabled={pending} onChange={setReminderSettings} onSave={() => execute(() => updateClassReminderSettings(reminderSettings))} settings={reminderSettings} /></div></details>
    {error && !selectedRow ? <p className="rounded-lg border border-destructive/30 p-3 text-destructive" role="alert">{error}</p> : null}
    <div className="flex flex-col gap-3 sm:flex-row"><input aria-label="Buscar contacto" className="h-10 min-w-0 rounded-lg border bg-card px-3 sm:w-80" onChange={(event) => { setFilter(event.target.value); setSelectedGuardianId(undefined); setError(undefined); }} placeholder="Buscar acudiente, teléfono o niño" value={filter} /><select aria-label="Filtrar por estado" className="h-10 min-w-0 rounded-lg border bg-card px-3 text-sm" onChange={(event) => { setResponse(event.target.value); setSelectedGuardianId(undefined); setError(undefined); }} value={response}><option value="all">Todos los estados</option><option value="not_contacted">Pendientes</option><option value="registered">Registrados</option><option value="contacted">Contactados</option><option value="no_response">Sin respuesta</option><option value="interested">Interesados</option><option value="declined">No interesados</option><option value="booked">Agendados</option></select></div>
    <p className="text-sm text-muted-foreground">Selecciona un acudiente para desplegar sus pasos de contacto, notas y actividad.</p>
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="block w-full text-sm md:table md:table-fixed">
        <thead className="hidden bg-muted/50 md:table-header-group"><tr><th scope="col" className="p-4 text-left font-semibold">Acudiente</th><th scope="col" className="p-4 text-left font-semibold">Niños</th><th scope="col" className="p-4 text-left font-semibold">Estado</th><th scope="col" className="p-4 text-left font-semibold">Próxima clase</th><th scope="col" className="p-4 text-left font-semibold">Última actualización</th></tr></thead>
        <tbody className="block md:table-row-group">{visible.map((row) => {
          const expanded = selectedGuardianId === row.guardianId;
          return <Fragment key={row.guardianId}>
            <tr className={`grid grid-cols-2 border-t align-top md:table-row ${expanded ? "bg-primary/5" : ""}`}>
              <td className="col-span-2 min-w-0 p-4 md:table-cell">
                <button aria-controls={expanded ? `tracking-detail-${row.guardianId}` : undefined} aria-expanded={expanded} aria-label={`${expanded ? "Ocultar" : "Ver"} seguimiento de ${row.guardianName}`} className="flex min-h-11 w-full items-center gap-2 rounded-lg text-left font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-50" disabled={pending} id={`tracking-toggle-${row.guardianId}`} onClick={() => toggleGuardian(row.guardianId)} type="button"><ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180 text-primary" : "text-muted-foreground"}`} /><span className="min-w-0 break-words">{row.guardianName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{formatColombianPhone(row.phone)}</span></span></button>
              </td>
              <td className="min-w-0 break-words p-4"><span className="mb-1 block text-xs text-muted-foreground md:hidden">Niños</span>{row.students.join(", ") || "Sin niños asociados"}<span className="mt-1 block text-xs text-muted-foreground">{row.enrolledCount} {row.enrolledCount === 1 ? "programado" : "programados"}</span></td>
              <td className="min-w-0 p-4"><span className="mb-1 block text-xs text-muted-foreground md:hidden">Estado</span><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${row.booked ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{responseLabel[trackingStatus(row)] ?? row.response}</span></td>
              <td className="col-span-2 min-w-0 break-words p-4"><span className="mb-1 block text-xs text-muted-foreground md:hidden">Próxima clase</span>{row.nextClass ?? "Sin clase"}</td>
              <td className="col-span-2 min-w-0 break-words p-4"><span className="mb-1 block text-xs text-muted-foreground md:hidden">Última actualización</span><span className="text-xs text-muted-foreground">{formatLastUpdate(row)}</span></td>
            </tr>
            {expanded ? <tr className="block md:table-row"><td className="block border-t border-primary/15 p-0 md:table-cell" colSpan={5}><TrackingDetail error={error} onClose={() => closeDetail(row.guardianId)} onExecute={execute} pending={pending} row={row} /></td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
    </div>
    {!visible.length ? <p className="p-5 text-center text-sm text-muted-foreground">No hay contactos con estos filtros.</p> : null}
  </div>;
}

function ReminderSettingsPanel({ disabled, onChange, onSave, settings }: Readonly<{ disabled: boolean; onChange: (settings: ClassReminderSettings) => void; onSave: () => void; settings: ClassReminderSettings }>) {
  function update(values: Partial<ClassReminderSettings>) { onChange({ ...settings, ...values }); }
  return <section className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-primary"><BellRing aria-hidden="true" className="size-5" /><h2 className="text-lg font-extrabold text-foreground">Recordatorios a profesores</h2></div><p className="mt-1 text-sm text-muted-foreground">Configura hasta dos avisos por correo antes de cada clase.</p></div><Button disabled={disabled} onClick={onSave} type="button">Guardar recordatorios</Button></div><div className="mt-5 grid gap-3 md:grid-cols-2"><ReminderSlot enabled={settings.firstEnabled} label="Recordatorio 1" leadMinutes={settings.firstLeadMinutes} onEnabledChange={(firstEnabled) => update({ firstEnabled })} onLeadChange={(firstLeadMinutes) => update({ firstLeadMinutes })} /><ReminderSlot enabled={settings.secondEnabled} label="Recordatorio 2" leadMinutes={settings.secondLeadMinutes} onEnabledChange={(secondEnabled) => update({ secondEnabled })} onLeadChange={(secondLeadMinutes) => update({ secondLeadMinutes })} /></div><p className="mt-4 text-xs text-muted-foreground">Los cambios reajustan los recordatorios pendientes de clases futuras.</p></section>;
}

function ReminderSlot({ enabled, label, leadMinutes, onEnabledChange, onLeadChange }: Readonly<{ enabled: boolean; label: string; leadMinutes: number; onEnabledChange: (enabled: boolean) => void; onLeadChange: (minutes: number) => void }>) {
  return <div className={`rounded-xl border p-4 transition-colors ${enabled ? "border-primary/20 bg-primary/[0.03]" : "bg-muted/30"}`}><label className="flex cursor-pointer items-center gap-3"><input checked={enabled} className="size-4 accent-primary" onChange={(event) => onEnabledChange(event.target.checked)} type="checkbox" /><span className="font-semibold text-foreground">{label}</span><span className={`ml-auto text-xs font-medium ${enabled ? "text-emerald-700" : "text-muted-foreground"}`}>{enabled ? "Activo" : "Inactivo"}</span></label><label className="mt-4 block text-sm text-muted-foreground"><span className="mb-1.5 block">Enviar</span><select className="h-10 w-full rounded-lg border bg-background px-3 font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={!enabled} onChange={(event) => onLeadChange(Number(event.target.value))} value={leadMinutes}>{reminderLeadOptions.map((minutes) => <option key={minutes} value={minutes}>{reminderLeadLabel(minutes)}</option>)}</select></label></div>;
}

function TrackingDetail({ error, onClose, onExecute, pending, row }: Readonly<{ error?: string; onClose: () => void; onExecute: (task: () => Promise<{ success: boolean; error?: string }>, onSuccess?: () => void) => void; pending: boolean; row: TrackingRow }>) {
  const [note, setNote] = useState("");
  const registeredFromPublicForm = Boolean(row.registeredFromPublicAt);
  const whatsAppContacted = row.events.some((event) => event.eventType === "whatsapp_opened");
  const responseConfirmed = ["interested", "declined", "no_response"].includes(row.response);
  const whatsAppUrl = `https://wa.me/${row.phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hola")}`;
  return <div className="min-w-0 border-l-2 border-primary bg-background/50 p-4 sm:p-6" aria-labelledby={`tracking-detail-title-${row.guardianId}`} id={`tracking-detail-${row.guardianId}`} role="region">
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-bold" id={`tracking-detail-title-${row.guardianId}`}>Seguimiento de {row.guardianName}</h2><p className="mt-1 break-words text-sm text-muted-foreground">Notas y actividad de este acudiente.</p></div><Button aria-label="Cerrar detalle" disabled={pending} onClick={onClose} type="button" variant="outline">Cerrar</Button></div>
      {error ? <p className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <section className="mt-6"><h3 className="font-semibold">Pasos de contacto</h3>{registeredFromPublicForm ? <div className="mt-3 rounded-lg border border-emerald-600 bg-emerald-50 p-4"><p className="text-sm font-semibold">Registro autónomo</p><p className="mt-1 text-sm text-muted-foreground">Este acudiente completó el formulario de registro. Consulta las clases programadas para confirmar si sus niños ya tienen una reserva.</p><p className="mt-2 text-sm text-emerald-800">Estado actual: {responseLabel[trackingStatus(row)]}.</p></div> : <div className="mt-3 space-y-3"><div className={`rounded-lg border p-4 ${whatsAppContacted ? "border-emerald-600 bg-emerald-50" : ""}`}><p className="text-sm font-semibold">Paso 1 · Contactar por WhatsApp</p><p className="mt-1 text-sm text-muted-foreground">WhatsApp se abrirá con el mensaje “Hola” listo para revisar y enviar.</p>{whatsAppContacted ? <p className="mt-2 text-sm text-emerald-800">Contacto registrado por WhatsApp.</p> : null}<div className="mt-3"><Button asChild variant="outline"><a href={whatsAppUrl} onClick={() => onExecute(() => recordWhatsAppOpened(row.guardianId))} rel="noreferrer" target="_blank">{whatsAppContacted ? "Abrir WhatsApp nuevamente" : "Abrir WhatsApp"}</a></Button></div></div><div className={`rounded-lg border p-4 ${responseConfirmed ? "border-emerald-600 bg-emerald-50" : ""}`}><p className="text-sm font-semibold">Paso 2 · Confirmar respuesta</p><p className="mt-1 text-sm text-muted-foreground">Registra la respuesta después de realizar el contacto.</p>{responseConfirmed ? <p className="mt-2 text-sm text-emerald-800">Respuesta registrada: {responseLabel[row.response]}.</p> : null}<select aria-label={`Respuesta de ${row.guardianName}`} className="mt-3 h-10 max-w-full rounded-lg border bg-background px-3 text-sm" disabled={pending || !whatsAppContacted} onChange={(event) => { if (event.target.value) onExecute(() => updateContactResponse(row.guardianId, event.target.value as "no_response" | "interested" | "declined")); }} value={responseConfirmed ? row.response : ""}><option value="">Seleccionar respuesta…</option><option value="interested">Interesado</option><option value="declined">No interesado</option><option value="no_response">Sin respuesta</option></select></div></div>}<form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const clean = note.trim(); if (!clean) return; onExecute(() => addContactNote(row.guardianId, clean), () => setNote("")); }}><label className="sr-only" htmlFor="tracking-note">Nota interna</label><input className="h-10 min-w-0 shrink-0 rounded-lg border bg-background px-3 text-sm sm:flex-1" disabled={pending} id="tracking-note" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Agregar nota interna" value={note} /><Button disabled={pending || !note.trim()} type="submit" variant="outline">Guardar nota</Button></form></section>
      <section className="mt-7 border-t pt-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-semibold">Actividad del seguimiento</h3><span className="text-xs text-muted-foreground">Última actualización: {formatLastUpdate(row)}</span></div>{row.events.length ? <ol className="mt-4 space-y-3">{row.events.map((event) => <li className="border-l-2 border-primary/30 pl-3" key={event.id}><p className="break-words text-sm">{eventDescription(event)}</p><p className="text-xs text-muted-foreground">Canal: {eventChannel(event.eventType)}</p><time className="text-xs text-muted-foreground" dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividad registrada para este seguimiento.</p>}</section>
    </section>
  </div>;
}
