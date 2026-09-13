import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkSite } from "@/lib/monitor";

// POST /api/monitoring/check/[id] — trigger immediate check
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const site = await prisma.siteMonitor.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await checkSite(site);
  return NextResponse.json({ ...result, siteName: site.name, url: site.url });
}