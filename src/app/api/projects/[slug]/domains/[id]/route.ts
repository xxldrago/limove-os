import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.value !== undefined) data.value = body.value;
  if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt);
  if (body.reminderDays !== undefined) data.reminderDays = body.reminderDays;
  if (body.notes !== undefined) data.notes = body.notes || null;

  const domain = await prisma.domainRecord.update({
    where: { id: Number(id) },
    data,
  });
  return NextResponse.json(domain);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.domainRecord.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
