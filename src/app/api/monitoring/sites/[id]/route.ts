import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/monitoring/sites/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const site = await prisma.siteMonitor.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const checks = await prisma.siteCheck.findMany({
    where: { siteId: id },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ...site, projectName: site.project?.name ?? null, checks });
}

// PUT /api/monitoring/sites/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.url !== undefined) {
    new URL(body.url); // throws on invalid
    data.url = body.url.trim();
  }
  if (body.projectId !== undefined) data.projectId = body.projectId ? Number(body.projectId) : null;
  if (body.checkInterval !== undefined) data.checkInterval = Number(body.checkInterval);
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const site = await prisma.siteMonitor.update({ where: { id }, data });
  return NextResponse.json(site);
}

// DELETE /api/monitoring/sites/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  await prisma.siteCheck.deleteMany({ where: { siteId: id } });
  const site = await prisma.siteMonitor.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: site.id });
}