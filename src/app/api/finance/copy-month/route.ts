import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/finance/copy-month
// Body: { month?: "YYYY-MM" } — copies the previous calendar month's EXPENSE transactions
// into the month given (defaults to current month). Returns { count, month, sourceMonth }.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const now = new Date();

  // Source = previous calendar month.
  const sourceStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sourceEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const sourceMonth = `${sourceStart.getFullYear()}-${String(sourceStart.getMonth() + 1).padStart(2, "0")}`;

  // Target month: default to the current month.
  let targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (body.month && /^\d{4}-\d{2}$/.test(String(body.month))) {
    targetMonth = String(body.month);
  }
  const [ty, tm] = targetMonth.split("-").map(Number);
  const targetStart = new Date(ty, tm - 1, 1);
  const targetEnd = new Date(ty, tm, 0, 23, 59, 59, 999);

  const sourceTxns = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      date: { gte: sourceStart, lte: sourceEnd },
    },
    select: {
      amount: true,
      description: true,
      paidById: true,
      projectId: true,
      category: true,
      date: true,
    },
  });

  if (sourceTxns.length === 0) {
    return NextResponse.json({ count: 0, month: targetMonth, sourceMonth });
  }

  const data = sourceTxns.map((t) => {
    const day = Math.min(t.date.getDate(), targetEnd.getDate());
    return {
      type: "EXPENSE",
      amount: Number(t.amount),
      description: t.description ?? "",
      paidById: t.paidById ?? 1,
      projectId: t.projectId,
      category: t.category ?? "Другое",
      date: new Date(targetStart.getFullYear(), targetStart.getMonth(), day),
    };
  });

  await prisma.transaction.createMany({ data });

  return NextResponse.json({
    count: sourceTxns.length,
    month: targetMonth,
    sourceMonth,
  });
}