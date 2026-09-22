import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    include: {
      credentials: { select: { id: true } },
      domains: { select: { id: true, name: true, value: true, expiresAt: true } },
      tasks: { select: { id: true } },
      siteMonitors: {
        select: { id: true, lastStatus: true, isError: true, checkedAt: true, isActive: true },
        orderBy: { id: "desc" },
      },
      transactions: {
        select: { type: true, amount: true },
      },
    },
  });

  const result = projects.map((p) => {
    let income = 0;
    let expenses = 0;
    for (const t of p.transactions) {
      const amt = Number(t.amount);
      if (t.type === "INCOME") income += amt;
      else expenses += amt;
    }

    // Determine site status from the latest monitor
    const monitor = p.siteMonitors[0];
    let siteStatus: "UP" | "DOWN" | "UNKNOWN" = "UNKNOWN";
    if (monitor) {
      if (monitor.isError) siteStatus = "DOWN";
      else if (monitor.lastStatus != null) siteStatus = "UP";
      else siteStatus = "UNKNOWN";
    }

    // Check for expiring domains — remember WHAT exactly expires (домен/хостинг/Тильда)
    const now = new Date();
    let domainWarning: "none" | "yellow" | "red" = "none";
    let expiring: {
      id: number;
      name: string;
      value: string;
      expiresAt: string;
      daysLeft: number;
      level: "yellow" | "red";
    } | null = null;

    for (const d of p.domains) {
      const daysLeft = Math.ceil(
        (new Date(d.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const level: "yellow" | "red" | null = daysLeft < 0 ? "red" : daysLeft < 30 ? "yellow" : null;
      if (!level) continue;

      if (level === "red") domainWarning = "red";
      else if (domainWarning !== "red") domainWarning = "yellow";

      // Показываем самое срочное: сначала просрочки, затем ближайший дедлайн.
      const isWorse =
        !expiring ||
        (level === "red" && expiring.level !== "red") ||
        (level === expiring.level && daysLeft < expiring.daysLeft);
      if (isWorse) {
        expiring = {
          id: d.id,
          name: d.name,
          value: d.value,
          expiresAt: new Date(d.expiresAt).toISOString(),
          daysLeft,
          level,
        };
      }
    }

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      income,
      expenses,
      profit: income - expenses,
      credentialsCount: p.credentials.length,
      domainsCount: p.domains.length,
      tasksCount: p.tasks.length,
      domainWarning,
      expiring,
      siteStatus,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = (body.name || "").trim() as string;
  const domainUrl = (body.domainUrl || "").trim() as string;
  const domain = (body.domain || "").trim() as string;
  const description = (body.description || "").trim() as string;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const url = domainUrl || domain;

  // Build a unique slug from the name.
  const baseSlug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "project";

  // Ensure slug uniqueness.
  let slug = baseSlug;
  let n = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }

  let project;
  try {
    project = await prisma.project.create({
      data: {
        slug,
        name,
        description: description || null,
        status: "ACTIVE",
      },
    });
  } catch {
    return NextResponse.json({ error: "Project already exists" }, { status: 409 });
  }

  // Auto-create a SiteMonitor linked to this project when a domain URL is given.
  if (url) {
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
      // Skip if a monitor with the same URL already exists.
      const existing = await prisma.siteMonitor.findUnique({ where: { url } });
      if (!existing) {
        await prisma.siteMonitor.create({
          data: {
            url,
            name,
            projectId: project.id,
          },
        });
      }
    } catch {
      // Invalid URL — do not block project creation.
    }
  }

  return NextResponse.json(project, { status: 201 });
}
