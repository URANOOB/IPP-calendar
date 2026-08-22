import { CycleWelcome } from "@/components/public-registration/cycle-welcome";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inscripción de clases" };

export default async function GeneralRegistrationPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_general_registration_welcome");
  const welcome = data?.[0] ?? { cycle_name: "Inscripción de clases", registration_open: false };
  return <CycleWelcome cycleName={welcome.cycle_name} registrationOpen={welcome.registration_open} />;
}
