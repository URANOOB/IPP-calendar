import { redirect } from "next/navigation";

export const metadata = { title: "Mis clases" };

export default async function MyClassesPage() {
  redirect("/dashboard/classes");
}
