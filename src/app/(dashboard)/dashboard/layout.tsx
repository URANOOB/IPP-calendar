import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ConfirmationProvider } from "@/components/ui/confirmation-dialog";
import { getRecentPlatformActivity } from "@/lib/platform-activity/service";
import { requireUser } from "@/lib/auth/user";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, activity] = await Promise.all([requireUser(), getRecentPlatformActivity()]);

  return <ConfirmationProvider><DashboardShell activity={activity} user={user}>{children}</DashboardShell></ConfirmationProvider>;
}
