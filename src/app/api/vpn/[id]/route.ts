import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.vpnSubscription.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(sub);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (body.provider !== undefined) data.provider = body.provider;
  if (body.serverName !== undefined) data.serverName = body.serverName || null;
  if (body.clientName !== undefined) data.clientName = body.clientName;
  if (body.url !== undefined) data.url = body.url || null;
  if (body.connectedAt !== undefined)
    data.connectedAt = body.connectedAt ? new Date(body.connectedAt) : null;
  if (body.expiresAt !== undefined)
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes || null;

  const sub = await prisma.vpnSubscription.update({
    where: { id: parseInt(params.id) },
    data,
  });

  return NextResponse.json(sub);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.vpnSubscription.delete({
    where: { id: parseInt(params.id) },
  });

  return NextResponse.json({ ok: true });
}