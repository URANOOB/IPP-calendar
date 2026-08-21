import { createClient } from "npm:@supabase/supabase-js@2";

type Reminder = {
  reminder_id: string;
  reminder_type: "teacher_24h" | "teacher_3h" | "manager_24h" | "manager_3h";
  recipient_email: string;
  recipient_name: string;
  class_id: string;
  class_title: string;
  class_starts_at: string;
  class_ends_at: string;
  teacher_name: string;
  student_count: number;
  guardian_count: number;
};

const BOGOTA_TIME_ZONE = "America/Bogota";
const emailEscape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
const formatDate = (value: string) => new Intl.DateTimeFormat("es-CO", { timeZone: BOGOTA_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat("es-CO", { timeZone: BOGOTA_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(value));

function appUrl() { return (Deno.env.get("APP_URL") ?? "").replace(/\/$/, ""); }
function subjectFor(reminder: Reminder) {
  if (reminder.reminder_type === "teacher_24h") return "Tu clase de IPP es mañana";
  if (reminder.reminder_type === "teacher_3h") return "Tu clase de IPP comienza en aproximadamente 3 horas";
  if (reminder.reminder_type === "manager_24h") return "Seguimiento requerido — clase mañana";
  return "Seguimiento requerido — clase en aproximadamente 3 horas";
}

function emailFor(reminder: Reminder) {
  const manager = reminder.reminder_type.startsWith("manager_");
  const detailUrl = manager ? `${appUrl()}/dashboard/tracking` : `${appUrl()}/dashboard/classes/${reminder.class_id}`;
  const timing = reminder.reminder_type.endsWith("24h") ? "mañana" : "en aproximadamente 3 horas";
  const heading = manager ? "Recordatorio de seguimiento" : "Recordatorio de clase";
  const body = manager
    ? `La clase de ${emailEscape(reminder.teacher_name)} comienza ${timing}. Realiza el contacto correspondiente por WhatsApp.`
    : `Tienes una clase programada para ${timing}.`;
  return {
    subject: subjectFor(reminder),
    html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h1 style="font-size:24px">${heading}</h1><p>Hola, ${emailEscape(reminder.recipient_name)}.</p><p>${body}</p><section style="border:1px solid #dbe4ee;border-radius:12px;padding:18px"><strong style="font-size:18px">${emailEscape(reminder.class_title)}</strong><p>Profesor: ${emailEscape(reminder.teacher_name)}<br>${formatDate(reminder.class_starts_at)}<br>${formatTime(reminder.class_starts_at)} – ${formatTime(reminder.class_ends_at)}<br>Niños inscritos: ${reminder.student_count}${manager ? `<br>Acudientes asociados: ${reminder.guardian_count}` : ""}</p></section>${detailUrl ? `<p><a href="${detailUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${manager ? "Ver seguimiento" : "Ver clase"}</a></p>` : ""}</main>`,
  };
}

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) return JSON.parse(modern).default as string;
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
}

Deno.serve(async (request) => {
  if (request.method !== "POST" || request.headers.get("x-reminder-cron-secret") !== Deno.env.get("REMINDER_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = Deno.env.get("SUPABASE_URL"); const key = serviceKey(); const resendKey = Deno.env.get("RESEND_API_KEY"); const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!url || !key || !resendKey || !from) return Response.json({ error: "Reminder service is not configured." }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: reminders, error } = await supabase.rpc("claim_due_class_reminders");
  if (error) { console.error("Could not claim class reminders.", { message: error.message }); return Response.json({ error: "Could not claim reminders." }, { status: 500 }); }

  let sent = 0; let failed = 0;
  for (const reminder of (reminders ?? []) as Reminder[]) {
    const email = emailFor(reminder);
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `ipp-class-reminder/${reminder.reminder_id}` }, body: JSON.stringify({ from, to: [reminder.recipient_email], subject: email.subject, html: email.html }) });
      const payload = await response.json() as { id?: string; message?: string };
      if (!response.ok || !payload.id) throw new Error(payload.message ?? `Resend returned ${response.status}.`);
      const { error: completeError } = await supabase.rpc("complete_class_reminder", { reminder_id: reminder.reminder_id, resend_email_id: payload.id });
      if (completeError) throw new Error("Email accepted but delivery state could not be saved.");
      sent += 1;
      console.log("Class reminder sent.", { reminderId: reminder.reminder_id, classId: reminder.class_id, recipient: reminder.recipient_email, resendEmailId: payload.id });
    } catch (sendError) {
      failed += 1;
      const message = sendError instanceof Error ? sendError.message : "Unknown delivery error.";
      await supabase.rpc("fail_class_reminder", { reminder_id: reminder.reminder_id, error_message: message });
      console.error("Class reminder failed.", { reminderId: reminder.reminder_id, classId: reminder.class_id, recipient: reminder.recipient_email, message });
    }
  }
  return Response.json({ claimed: reminders?.length ?? 0, sent, failed });
});
