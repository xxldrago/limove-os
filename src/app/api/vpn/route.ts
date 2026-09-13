import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (provider && provider !== "ALL") where.provider = provider;
  if (status && status !== "ALL") where.status = status;

  const subs = await prisma.vpnSubscription.findMany({
    where,
    orderBy: [{ expiresAt: "asc" }, { id: "desc" }],
  });

  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { provider, serverName, clientName, url, connectedAt, expiresAt, status, notes } = body;

  if (!provider || !clientName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sub = await prisma.vpnSubscription.create({
    data: {
      provider,
      serverName: serverName || null,
      clientName,
      url: url || null,
      connectedAt: connectedAt ? new Date(connectedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: status || "ACTIVE",
      notes: notes || null,
    },
  });

  return NextResponse.json(sub, { status: 201 });
}