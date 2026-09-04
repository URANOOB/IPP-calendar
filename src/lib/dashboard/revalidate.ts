import { revalidatePath } from "next/cache";

/** Operational records are shared by the calendar, lists, details and tracking. */
export function revalidateDashboard() {
  revalidatePath("/dashboard", "layout");
}
