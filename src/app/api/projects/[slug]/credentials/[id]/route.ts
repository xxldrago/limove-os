import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.serviceName !== undefined) data.serviceName = body.serviceName;
  if (body.login !== undefined) data.login = body.login || null;
  if (body.password !== undefined) data.passwordEnc = encrypt(body.password);
  if (body.url !== undefined) data.url = body.url || null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.notes !== undefined) data.notes = body.notes || null;

  const credential = await prisma.credential.update({
    where: { id: Number(id) },
    data,
  });
  return NextResponse.json(credential);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.credential.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
