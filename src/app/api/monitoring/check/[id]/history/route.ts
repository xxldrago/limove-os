import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/monitoring/check/[id]/history?days=7&limit=N
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const site = await prisma.siteMonitor.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const searchParams = new URL(req.url).searchParams;
  const days = Number(searchParams.get("days") ?? 7);
  const limit = Number(searchParams.get("limit") ?? 200);

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const checks = await prisma.siteCheck.findMany({
    where: { siteId: id, checkedAt: { gte: from } },
    orderBy: { checkedAt: "asc" },
    take: limit,
  });

  return NextResponse.json({ siteId: id, days, checks });
}