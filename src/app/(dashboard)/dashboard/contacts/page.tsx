import { ContactsManager, type ContactListItem } from "@/components/contacts/contacts-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contactos" };

export default async function ContactsPage() {
  await requireDashboardRoute("/dashboard/contacts");
  const supabase = await createClient();
  const [{ data: guardians, error: guardiansError }, { data: students, error: studentsError }] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone, active, access_token_hash").order("full_name"),
    supabase.from("students").select("guardian_id"),
  ]);

  if (guardiansError || studentsError) {
    return <p className="rounded-xl border bg-card p-6 text-sm text-destructive">No fue posible cargar los acudientes. Actualiza la página para intentarlo de nuevo.</p>;
  }

  const studentCounts = new Map<string, number>();
  students.forEach((student) => studentCounts.set(student.guardian_id, (studentCounts.get(student.guardian_id) ?? 0) + 1));
  const contacts: ContactListItem[] = guardians.map((guardian) => ({
    id: guardian.id,
    fullName: guardian.full_name,
    phone: guardian.phone,
    active: guardian.active,
    studentCount: studentCounts.get(guardian.id) ?? 0,
    hasPrivateLink: guardian.access_token_hash !== null,
  }));

  return <><PageHeader title="Contactos" description="Administra los acudientes y sus accesos privados." /><ContactsManager contacts={contacts} /></>;
}
