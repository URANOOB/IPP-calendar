"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellRing, Eye } from "lucide-react";

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
    whatsapp_opened: "Se realizó el contacto por WhatsApp.",
    attendance_updated: `Se registró asistencia: ${attendance === "attended" ? "asistió" : attendance === "absent" ? "no asistió" : "actualizada"}.`,
    note_added: note ? `Se agregó una nota: ${note}` : "Se agregó una nota.",
    manager_assigned: "Se actualizó el responsable.",
    registered_from_form: "El acudiente se registró directamente desde el formulario.",
  };
  return labels[event.eventType];
}

export function TrackingManager({ reminderSettings: initialReminderSettings, rows }: { reminderSettings: ClassReminderSettings; rows: TrackingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [response, setResponse] = useState("all");
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [reminderSettings, setReminderSettings] = useState(initialReminderSettings);
  const visible = rows.filter((row) => (response === "all" || (response === "interested" && Boolean(row.registeredFromPublicAt)) || row.response === response || (response === "booked" && row.booked)) && `${row.guardianName} ${row.phone} ${row.students.join(" ")}`.toLowerCase().includes(filter.toLowerCase()));
  const selectedRow = rows.find((row) => row.guardianId === selectedGuardianId);

  function execute(task: () => Promise<{ success: boolean; error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (!result.success) {
        setError(result.error ?? "No pudimos actualizar el seguimiento.");
        return;
      }
      router.refresh();
    });
  }

  return <div className="space-y-4">
    <ReminderSettingsPanel disabled={pending} onChange={setReminderSettings} onSave={() => execute(() => updateClassReminderSettings(reminderSettings))} settings={reminderSettings} />
    {error ? <p className="rounded-lg border border-destructive/30 p-3 text-destructive" role="alert">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><input aria-label="Buscar contacto" className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setFilter(event.target.value)} placeholder="Buscar acudiente, teléfono o niño" value={filter} /><select aria-label="Filtrar por estado" onChange={(event) => setResponse(event.target.value)} value={response}><option value="all">Todos los estados</option><option value="not_contacted">Pendientes</option><option value="registered">Registrados</option><option value="no_response">Sin respuesta</option><option value="interested">Interesados</option><option value="declined">No interesados</option><option value="booked">Agendados</option></select></div>
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="min-w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left font-semibold">Acudiente</th><th className="p-3 text-left font-semibold">Niños</th><th className="p-3 text-left font-semibold">Estado</th><th className="p-3 text-left font-semibold">Próxima clase</th><th className="p-3 text-left font-semibold">Última actualización</th><th className="p-3 text-left font-semibold">Acciones</th></tr></thead><tbody>{visible.map((row) => <tr className="border-t align-top" key={row.guardianId}><td className="p-3"><strong>{row.guardianName}</strong><br /><span className="text-xs text-muted-foreground">{formatColombianPhone(row.phone)}</span></td><td className="p-3">{row.students.join(", ") || "Sin niños asociados"}<br /><small>{row.enrolledCount} programados</small></td><td className="p-3">{row.registeredFromPublicAt ? "Interesado" : row.booked ? "Agendado" : responseLabel[row.response] ?? row.response}</td><td className="p-3">{row.nextClass ?? "Sin clase"}</td><td className="p-3"><span className="whitespace-nowrap text-xs text-muted-foreground">{formatLastUpdate(row)}</span></td><td className="p-3"><Button aria-label={`Ver seguimiento de ${row.guardianName}`} onClick={() => { setError(undefined); setSelectedGuardianId(row.guardianId); }} size="icon" title="Ver seguimiento" type="button" variant="outline"><Eye aria-hidden="true" /></Button></td></tr>)}</tbody></table></div>
    {selectedRow ? <TrackingDetail error={error} onClose={() => setSelectedGuardianId(undefined)} onExecute={execute} pending={pending} row={selectedRow} /> : null}
  </div>;
}

function ReminderSettingsPanel({ disabled, onChange, onSave, settings }: Readonly<{ disabled: boolean; onChange: (settings: ClassReminderSettings) => void; onSave: () => void; settings: ClassReminderSettings }>) {
  function update(values: Partial<ClassReminderSettings>) { onChange({ ...settings, ...values }); }
  return <section className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-primary"><BellRing aria-hidden="true" className="size-5" /><h2 className="text-lg font-extrabold text-foreground">Recordatorios a profesores</h2></div><p className="mt-1 text-sm text-muted-foreground">Configura hasta dos avisos por correo antes de cada clase.</p></div><Button disabled={disabled} onClick={onSave} type="button">Guardar recordatorios</Button></div><div className="mt-5 grid gap-3 md:grid-cols-2"><ReminderSlot enabled={settings.firstEnabled} label="Recordatorio 1" leadMinutes={settings.firstLeadMinutes} onEnabledChange={(firstEnabled) => update({ firstEnabled })} onLeadChange={(firstLeadMinutes) => update({ firstLeadMinutes })} /><ReminderSlot enabled={settings.secondEnabled} label="Recordatorio 2" leadMinutes={settings.secondLeadMinutes} onEnabledChange={(secondEnabled) => update({ secondEnabled })} onLeadChange={(secondLeadMinutes) => update({ secondLeadMinutes })} /></div><p className="mt-4 text-xs text-muted-foreground">Los cambios reajustan los recordatorios pendientes de clases futuras.</p></section>;
}

function ReminderSlot({ enabled, label, leadMinutes, onEnabledChange, onLeadChange }: Readonly<{ enabled: boolean; label: string; leadMinutes: number; onEnabledChange: (enabled: boolean) => void; onLeadChange: (minutes: number) => void }>) {
  return <div className={`rounded-xl border p-4 transition-colors ${enabled ? "border-primary/20 bg-primary/[0.03]" : "bg-muted/30"}`}><label className="flex cursor-pointer items-center gap-3"><input checked={enabled} className="size-4 accent-primary" onChange={(event) => onEnabledChange(event.target.checked)} type="checkbox" /><span className="font-semibold text-foreground">{label}</span><span className={`ml-auto text-xs font-medium ${enabled ? "text-emerald-700" : "text-muted-foreground"}`}>{enabled ? "Activo" : "Inactivo"}</span></label><label className="mt-4 block text-sm text-muted-foreground"><span className="mb-1.5 block">Enviar</span><select className="h-10 w-full rounded-lg border bg-background px-3 font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={!enabled} onChange={(event) => onLeadChange(Number(event.target.value))} value={leadMinutes}>{reminderLeadOptions.map((minutes) => <option key={minutes} value={minutes}>{reminderLeadLabel(minutes)}</option>)}</select></label></div>;
}

function TrackingDetail({ error, onClose, onExecute, pending, row }: Readonly<{ error?: string; onClose: () => void; onExecute: (task: () => Promise<{ success: boolean; error?: string }>) => void; pending: boolean; row: TrackingRow }>) {
  const [note, setNote] = useState("");
  const registeredFromPublicForm = Boolean(row.registeredFromPublicAt);
  const whatsAppContacted = row.events.some((event) => event.eventType === "whatsapp_opened");
  const responseConfirmed = ["interested", "declined", "no_response"].includes(row.response);
  const whatsAppUrl = `https://wa.me/${row.phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hola")}`;
  return <div aria-labelledby="tracking-detail-title" aria-modal="true" className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-6" onMouseDown={onClose} role="dialog">
    <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl sm:max-w-2xl sm:rounded-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold" id="tracking-detail-title">Seguimiento de {row.guardianName}</h2><p className="mt-1 text-sm text-muted-foreground">{formatColombianPhone(row.phone)} · {row.students.join(", ") || "Sin niños asociados"}</p></div><Button aria-label="Cerrar detalle" onClick={onClose} type="button" variant="outline">Cerrar</Button></div>
      {error ? <p className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <section className="mt-6"><h3 className="font-semibold">Workflow de contacto</h3>{registeredFromPublicForm ? <div className="mt-3 rounded-lg border border-emerald-600 bg-emerald-50 p-4"><p className="text-sm font-semibold">Registro autónomo</p><p className="mt-1 text-sm text-muted-foreground">Este acudiente se registró directamente desde el formulario y ya agendó las clases de sus niños.</p><p className="mt-2 text-sm text-emerald-800">Estado asignado: Interesado.</p></div> : <div className="mt-3 space-y-3"><div className={`rounded-lg border p-4 ${whatsAppContacted ? "border-emerald-600 bg-emerald-50" : ""}`}><p className="text-sm font-semibold">Paso 1 · Contactar por WhatsApp</p><p className="mt-1 text-sm text-muted-foreground">Se enviará el mensaje: “Hola”.</p>{whatsAppContacted ? <p className="mt-2 text-sm text-emerald-800">Contacto registrado por WhatsApp.</p> : null}<div className="mt-3"><Button asChild variant="outline"><a href={whatsAppUrl} onClick={() => onExecute(() => recordWhatsAppOpened(row.guardianId))} rel="noreferrer" target="_blank">{whatsAppContacted ? "Abrir WhatsApp nuevamente" : "Enviar por WhatsApp"}</a></Button></div></div><div className={`rounded-lg border p-4 ${responseConfirmed ? "border-emerald-600 bg-emerald-50" : ""}`}><p className="text-sm font-semibold">Paso 2 · Confirmar respuesta</p><p className="mt-1 text-sm text-muted-foreground">Registra la respuesta después de realizar el contacto.</p>{responseConfirmed ? <p className="mt-2 text-sm text-emerald-800">Respuesta registrada: {responseLabel[row.response]}.</p> : null}<select aria-label={`Respuesta de ${row.guardianName}`} className="mt-3 h-10 rounded-lg border bg-background px-3 text-sm" disabled={pending || !whatsAppContacted} onChange={(event) => { if (event.target.value) onExecute(() => updateContactResponse(row.guardianId, event.target.value as "no_response" | "interested" | "declined")); }} value={responseConfirmed ? row.response : ""}><option value="">Seleccionar respuesta…</option><option value="interested">Interesado</option><option value="declined">No interesado</option><option value="no_response">Sin respuesta</option></select></div></div>}<form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const clean = note.trim(); if (!clean) return; onExecute(() => addContactNote(row.guardianId, clean)); setNote(""); }}><label className="sr-only" htmlFor="tracking-note">Nota interna</label><input className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm" disabled={pending} id="tracking-note" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Agregar nota interna" value={note} /><Button disabled={pending || !note.trim()} type="submit" variant="outline">Guardar nota</Button></form></section>
      <section className="mt-7 border-t pt-5"><div className="flex items-baseline justify-between gap-3"><h3 className="font-semibold">Actividad del seguimiento</h3><span className="text-xs text-muted-foreground">Última actualización: {formatLastUpdate(row)}</span></div>{row.events.length ? <ol className="mt-4 space-y-3">{row.events.map((event) => <li className="border-l-2 border-primary/30 pl-3" key={event.id}><p className="text-sm">{eventDescription(event)}</p><p className="text-xs text-muted-foreground">Canal: {eventChannel(event.eventType)}</p><time className="text-xs text-muted-foreground" dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividad registrada para este seguimiento.</p>}</section>
    </section>
  </div>;
}
