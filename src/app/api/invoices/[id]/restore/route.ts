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
  if (existing.status !== "CANCELLED") {
    return NextResponse.json({ error: "Only cancelled invoices can be restored" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id: parseInt(id) },
    data: {
      status: "PENDING",
      cancelReason: null,
      cancelledAt: null,
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json(updated);
}
