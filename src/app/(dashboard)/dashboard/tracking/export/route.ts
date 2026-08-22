import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

import { requireDashboardRoute } from "@/lib/auth/authorization";
import { formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

const headers = ["Acudiente", "Teléfono", "Estudiante", "Gestor", "Primer contacto", "Invitación enviada", "Respuesta", "Agendó", "Clase", "Profesor", "Fecha", "Asistencia"];
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  await requireDashboardRoute("/dashboard/tracking"); const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv"; const supabase = await createClient();
  const [{ data: registrations }, { data: students }, { data: guardians }, { data: tracking }, { data: classes }, { data: teachers }, { data: profiles }] = await Promise.all([
    supabase.from("registrations").select("student_id, class_id, status").in("status", ["pending", "confirmed", "attended", "absent"]), supabase.from("students").select("id, guardian_id, full_name"), supabase.from("guardians").select("id, full_name, phone"), supabase.from("contact_tracking").select("guardian_id, assigned_to, first_contact_at, invitation_sent_at, response_status"), supabase.from("classes").select("id, title, teacher_id, starts_at"), supabase.from("teachers").select("id, display_name"), supabase.from("profiles").select("id, full_name"),
  ]);
  const rows = (guardians ?? []).flatMap((guardian) => { const track = tracking?.find((item) => item.guardian_id === guardian.id); const manager = profiles?.find((item) => item.id === track?.assigned_to); const guardianStudents = students?.filter((item) => item.guardian_id === guardian.id) ?? []; const exportStudents = guardianStudents.length ? guardianStudents : [{ id: "", full_name: "" }]; return exportStudents.flatMap((student) => { const entries = student.id ? (registrations ?? []).filter((registration) => registration.student_id === student.id) : []; const exportEntries = entries.length ? entries : [null]; return exportEntries.map((registration) => { const classItem = registration ? classes?.find((item) => item.id === registration.class_id) : null; const teacher = classItem ? teachers?.find((item) => item.id === classItem.teacher_id) : null; return [guardian.full_name ?? "", guardian.phone, student.full_name, manager?.full_name ?? "Sin responsable", track?.first_contact_at ? formatBogotaDateTime(track.first_contact_at) : "", track?.invitation_sent_at ? formatBogotaDateTime(track.invitation_sent_at) : "", track?.response_status ?? "not_contacted", registration ? "Sí" : "No", classItem?.title ?? "", teacher?.display_name ?? "", classItem ? formatBogotaDateTime(classItem.starts_at) : "", registration?.status === "attended" ? "Asistió" : registration?.status === "absent" ? "No asistió" : ""]; }); }); });
  const filename = `ipp-seguimiento-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") return new Response([headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` } });
  const workbook = new ExcelJS.Workbook(); const worksheet = workbook.addWorksheet("Seguimiento"); worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(16, header.length + 4) })); worksheet.addRows(rows); worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }; worksheet.views = [{ state: "frozen", ySplit: 1 }]; worksheet.autoFilter = { from: "A1", to: `L${Math.max(rows.length + 1, 1)}` };
  const buffer = await workbook.xlsx.writeBuffer(); return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"` } });
}
