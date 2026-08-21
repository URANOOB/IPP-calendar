import { redirect } from "next/navigation";

export const metadata = { title: "Contactos" };

export default function ContactsPage() {
  redirect("/dashboard/contacts");
}
