import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      paidBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(transaction);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, amount, description, paidById, projectId, category, date } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (type !== undefined) data.type = type;
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (description !== undefined) data.description = description;
  if (paidById !== undefined) data.paidById = parseInt(paidById);
  if (projectId !== undefined) data.projectId = projectId ? parseInt(projectId) : null;
  if (category !== undefined) data.category = category;
  if (date !== undefined) data.date = new Date(date);

  const transaction = await prisma.transaction.update({
    where: { id: parseInt(params.id) },
    data,
    include: {
      paidBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json(transaction);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.transaction.delete({
    where: { id: parseInt(params.id) },
  });

  return NextResponse.json({ success: true });
}
