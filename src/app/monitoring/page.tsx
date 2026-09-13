import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { MonitoringDashboard } from "./monitoring-dashboard";

export default async function Page() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <AppShell userName={session.user.name ?? undefined} userEmail={session.user.email ?? undefined}>
      <MonitoringDashboard />
    </AppShell>
  );
}