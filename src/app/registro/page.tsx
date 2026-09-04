import { CycleWelcome } from "@/components/public-registration/cycle-welcome";
import { createClient } from "@/lib/supabase/server";

type WelcomeData = {
  cycle_name: string;
  registration_open: boolean;
  registration_status: "open" | "not_started" | "ended" | "no_active_cycle";
};

export const metadata = { title: "Inscripción de clases" };

export default async function GeneralRegistrationPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_general_registration_welcome");
  const welcome = (data?.[0] as WelcomeData) ?? { cycle_name: "Inscripción de clases", registration_open: false, registration_status: "no_active_cycle" };
  return <CycleWelcome cycleName={welcome.cycle_name} registrationOpen={welcome.registration_open} registrationStatus={welcome.registration_status} />;
}
