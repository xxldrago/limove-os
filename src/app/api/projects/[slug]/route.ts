import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      transactions: {
        select: { type: true, amount: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
  for (const t of project.tasks) {
    if (t.status in taskCounts) {
      taskCounts[t.status as keyof typeof taskCounts]++;
    }
  }

  const monitor = project.siteMonitors[0];
  let siteStatus: "UP" | "DOWN" | "UNKNOWN" = "UNKNOWN";
  if (monitor) {
    if (monitor.isError) siteStatus = "DOWN";
    else if (monitor.lastStatus != null) siteStatus = "UP";
    else siteStatus = "UNKNOWN";
  }

  // Invoices for this project (for the «Счета» tab).
  const invoices = await prisma.invoice.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ...project,
    siteStatus,
    invoices,
    totalIncome,
    totalExpenses,
    profit: totalIncome - totalExpenses,
    taskCounts,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json();

  const updated = await prisma.project.update({
    where: { slug },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json(updated);
}
