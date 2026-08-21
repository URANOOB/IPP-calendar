import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { getCurrentTeacher } from "@/lib/auth/user";
import { getClassTemporalStatus } from "@/lib/classes/helpers";
import { formatBogotaDate, formatBogotaDateTime } from "@/lib/cycles/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mis clases" };

export default async function MyClassesPage() {
  await requireDashboardRoute("/dashboard/my-classes");
  const teacher = await getCurrentTeacher(); if (!teacher) return <p>No encontramos un perfil de profesor activo.</p>;
  const cutoff = new Date(); cutoff.setHours(cutoff.getHours() - 24);
  const supabase = await createClient(); const { data: classes } = await supabase.from("classes").select("id, title, starts_at, ends_at, status, meeting_url").eq("teacher_id", teacher.id).gte("ends_at", cutoff.toISOString()).order("starts_at");
  const classIds = classes?.map((item) => item.id) ?? []; const { data: registrations } = classIds.length ? await supabase.from("registrations").select("class_id").in("class_id", classIds).in("status", ["pending", "confirmed", "attended", "absent"]) : { data: [] as { class_id: string }[] };
  return <section className="space-y-5"><div><h1 className="text-3xl font-bold">Mis próximas clases</h1><p className="mt-2 text-muted-foreground">Consulta el horario, los estudiantes inscritos y el acceso a videollamada.</p></div>{classes?.length ? <div className="grid gap-4">{classes.map((item) => { const enrolled = registrations?.filter((registration) => registration.class_id === item.id).length ?? 0; return <article className="rounded-xl border bg-card p-5" key={item.id}><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-2">{formatBogotaDate(item.starts_at)} · {formatBogotaDateTime(item.starts_at).split(", ").at(-1)} – {formatBogotaDateTime(item.ends_at).split(", ").at(-1)}</p><p className="mt-1 text-sm text-muted-foreground">{enrolled} niños inscritos · {getClassTemporalStatus(item)}</p><div className="mt-4 flex flex-wrap gap-3">{item.meeting_url ? <Button asChild variant="outline"><a href={item.meeting_url} rel="noreferrer" target="_blank">Abrir videollamada</a></Button> : null}<Button asChild><Link href={`/dashboard/classes/${item.id}`}>Ver detalle</Link></Button></div></article>; })}</div> : <p className="rounded-xl border bg-card p-5 text-muted-foreground">No tienes clases próximas.</p>}</section>;
}
