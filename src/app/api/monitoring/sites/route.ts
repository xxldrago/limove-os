import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/monitoring/sites — list all with latest check + uptime
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = await prisma.siteMonitor.findMany({
    orderBy: { id: "asc" },
    include: { project: { select: { id: true, name: true } } },
  });

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days7 = new Date(now - 7 * dayMs);
  const days30 = new Date(now - 30 * dayMs);

  const result = await Promise.all(
    sites.map(async (s) => {
      const [checks7, checks30] = await Promise.all([
        prisma.siteCheck.findMany({
          where: { siteId: s.id, checkedAt: { gte: days7 } },
          select: { isError: true, latencyMs: true },
        }),
        prisma.siteCheck.groupBy({
          by: ["isError"],
          where: { siteId: s.id, checkedAt: { gte: days30 } },
          _count: { _all: true },
        }),
      ]);

      const ok7 = checks7.filter((c) => !c.isError).length;
      const uptime7 = checks7.length > 0 ? Math.round((ok7 / checks7.length) * 100) : null;

      const total30 = checks30.reduce((a, g) => a + g._count._all, 0);
      const err30 = checks30.find((g) => g.isError)?._count._all ?? 0;
      const uptime30 = total30 > 0 ? Math.round(((total30 - err30) / total30) * 100) : null;

      return {
        id: s.id,
        name: s.name,
        url: s.url,
        projectId: s.projectId,
        projectName: s.project?.name ?? null,
        isActive: s.isActive,
        checkInterval: s.checkInterval,
        lastStatus: s.lastStatus,
        lastLatency: s.lastLatency,
        isError: s.isError,
        downSince: s.downSince,
        checkedAt: s.checkedAt,
        uptime7,
        uptime30,
        hasChecks: checks7.length + total30 > 0,
      };
    })
  );

  return NextResponse.json(result);
}

// POST /api/monitoring/sites — create site
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, url, projectId, checkInterval, isActive } = body;

  if (!name || !url) return NextResponse.json({ error: "Имя и URL обязательны" }, { status: 400 });

  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
  }

  const site = await prisma.siteMonitor.create({
    data: {
      name,
      url: url.trim(),
      projectId: projectId ? Number(projectId) : null,
      checkInterval: Number(checkInterval) || 300,
      isActive: isActive !== false,
    },
  });

  return NextResponse.json(site, { status: 201 });
}