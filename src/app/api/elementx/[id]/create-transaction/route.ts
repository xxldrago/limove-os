import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Mark an ElementX user as PAID and optionally create an income transaction.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(params.id);
  const body = await req.json();
  const { amount, description, category, createTransaction } = body;

  const user = await prisma.elementxUser.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.elementxUser.update({
    where: { id: userId },
    data: {
      status: "PAID",
      paidDate: user.paidDate ?? new Date(),
    },
  });

  let transaction = null;
  if (createTransaction && amount) {
    transaction = await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: parseFloat(amount),
        description: description || `Оплата ElementX: ${user.fullName}`,
        paidById: parseInt(session.user.id || "1"),
        projectId: null,
        category: category || "Другое",
        date: new Date(),
      },
    });
  }

  return NextResponse.json({ user: updated, transaction });
}