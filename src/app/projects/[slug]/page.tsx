import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import type { SerializedProject } from "@/components/projects/types";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      credentials: { orderBy: { serviceName: "asc" } },
      domains: { orderBy: { expiresAt: "asc" } },
      tasks: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] },
      files: { orderBy: { createdAt: "desc" } },
      siteMonitors: {
        select: { id: true, name: true, url: true, lastStatus: true, isError: true, checkedAt: true, isActive: true },
        orderBy: { id: "desc" },
      },
      transactions: { select: { type: true, amount: true } },
    },
  });

  if (!project) notFound();

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of project.transactions) {
    const amt = Number(t.amount);
    if (t.type === "INCOME") totalIncome += amt;
    else totalExpenses += amt;
  }

  const taskCounts = {
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    REVIEW: 0,
    DONE: 0,
  };
  for (const t of project.tasks as { status: string }[]) {
    if (t.status in taskCounts) {
      taskCounts[t.status as keyof typeof taskCounts]++;
    }
  }

  // Site status from latest monitor.
  const monitor = project.siteMonitors[0];
  let siteStatus: "UP" | "DOWN" | "UNKNOWN" = "UNKNOWN";
  if (monitor) {
    if (monitor.isError) siteStatus = "DOWN";
    else if (monitor.lastStatus != null) siteStatus = "UP";
    else siteStatus = "UNKNOWN";
  }

  // Invoices for this project («Счета» tab).
  const invoices = await prisma.invoice.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    ...project,
    totalIncome,
    totalExpenses,
    profit: totalIncome - totalExpenses,
    taskCounts,
    siteStatus,
    invoices: JSON.parse(JSON.stringify(invoices)),
    // Serialize for client component (Dates -> ISO strings)
    credentials: JSON.parse(JSON.stringify(project.credentials)),
    domains: JSON.parse(JSON.stringify(project.domains)),
    tasks: JSON.parse(JSON.stringify(project.tasks)),
    notes: JSON.parse(JSON.stringify(project.notes)),
    files: JSON.parse(JSON.stringify(project.files)),
    siteMonitors: JSON.parse(JSON.stringify(project.siteMonitors)),
  } as unknown as SerializedProject;

  return (
    <AppShell userName={session.user.name ?? undefined} userEmail={session.user.email ?? undefined}>
      <ProjectDetailClient project={data} />
    </AppShell>
  );
}
