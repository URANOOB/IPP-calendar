import { redirect } from "next/navigation";

import { ContactsManager, type ContactListItem } from "@/components/contacts/contacts-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireDashboardRoute } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contactos" };

const PAGE_SIZE = 25;

type ContactsPageProps = Readonly<{
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}>;

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  await requireDashboardRoute("/dashboard/contacts");
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = (params.search ?? "").trim().slice(0, 80);
  const status = params.status === "active" || params.status === "inactive" ? params.status : "all";
  const active = status === "active" ? true : status === "inactive" ? false : null;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("list_contact_guardians", {
    p_search: search || null,
    p_active: active,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });

  if (error) {
    return <p className="rounded-xl border bg-card p-6 text-sm text-destructive">No fue posible cargar los acudientes. Actualiza la página para intentarlo de nuevo.</p>;
  }

  if (!rows?.length && page > 1) {
    const fallbackParams = new URLSearchParams();
    if (search) fallbackParams.set("search", search);
    if (status !== "all") fallbackParams.set("status", status);
    fallbackParams.set("page", String(page - 1));
    redirect(`/dashboard/contacts?${fallbackParams.toString()}`);
  }

  const contacts: ContactListItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    phone: row.phone,
    active: row.active,
    studentCount: row.student_count,
    privateAccessToken: row.access_token,
  }));
  const total = rows?.[0]?.total_count ?? 0;

  return <><PageHeader title="Contactos" description="Administra los acudientes y sus accesos privados." /><ContactsManager contacts={contacts} page={page} pageSize={PAGE_SIZE} search={search} status={status} total={total} /></>;
}
