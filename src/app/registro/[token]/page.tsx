import { redirect } from "next/navigation";

export const metadata = { title: "Inscripción de clases" };

export default function LegacyCycleRegistrationPage() {
  redirect("/registro");
}
