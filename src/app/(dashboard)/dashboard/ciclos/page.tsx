import { redirect } from "next/navigation";

export const metadata = { title: "Ciclos" };

export default function CyclesPage() {
  redirect("/dashboard/cycles");
}
