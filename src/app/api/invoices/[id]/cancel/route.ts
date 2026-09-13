import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({ where: { id: parseInt(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { reason } = body;

  if (!reason) {
    return NextResponse.json({ error: "Cancel reason is required" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id: parseInt(id) },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
      cancelledAt: new Date(),
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      title: "Счёт обнулён",
      content: `Счёт обнулён: ${existing.description} — ${reason}`,
      type: "INVOICE",
      sentToTg: false,
    },
  });

  return NextResponse.json(updated);
}
