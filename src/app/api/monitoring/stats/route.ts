import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/monitoring/stats — overall stats
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = await prisma.siteMonitor.findMany({
    where: { isActive: true },
    select: { id: true, isError: true, lastLatency: true },
  });

  const total = sites.length;
  const online = sites.filter((s) => !s.isError).length;
  const offline = sites.filter((s) => s.isError).length;

  const latencies = sites
    .map((s) => s.lastLatency)
    .filter((l): l is number => l !== null && l !== undefined && l > 0);
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

  return NextResponse.json({ total, online, offline, avgLatency });
}