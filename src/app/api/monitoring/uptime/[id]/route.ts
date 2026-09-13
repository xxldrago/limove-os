import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/monitoring/uptime/[id]?days=30
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const site = await prisma.siteMonitor.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const searchParams = new URL(req.url).searchParams;
  const days = Number(searchParams.get("days") ?? 30);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const checks = await prisma.siteCheck.findMany({
    where: { siteId: id, checkedAt: { gte: from } },
    select: { isError: true, checkedAt: true },
  });

  const total = checks.length;
  const errors = checks.filter((c) => c.isError).length;
  const uptime = total > 0 ? Math.round(((total - errors) / total) * 1000) / 10 : null;

  // Daily breakdown for sparkline (up=1, down=0 per day)
  const daily: { date: string; up: number; down: number }[] = [];
  const map = new Map<string, { up: number; down: number }>();
  for (const c of checks) {
    const key = c.checkedAt.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { up: 0, down: 0 };
    if (c.isError) entry.down += 1;
    else entry.up += 1;
    map.set(key, entry);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key);
    daily.push({ date: key, up: entry?.up ?? 0, down: entry?.down ?? 0 });
  }

  return NextResponse.json({ siteId: id, days, total, errors, uptime, daily });
}