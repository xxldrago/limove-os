import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/finance/goal?year=YYYY — the goal for a year + earned/remaining totals
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year") as string)
    : new Date().getFullYear();

  const [goal, incomeAgg] = await Promise.all([
    prisma.financialGoal.findUnique({ where: { year } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: "INCOME",
        date: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59, 999),
        },
      },
    }),
  ]);

  const targetAmount = goal ? Number(goal.targetAmount) : null;
  const earned = Number(incomeAgg._sum.amount ?? 0);

  return NextResponse.json({
    year,
    targetAmount,
    earned,
    remaining: targetAmount != null ? Math.max(0, targetAmount - earned) : null,
    progress: targetAmount && targetAmount > 0 ? Math.min(100, (earned / targetAmount) * 100) : 0,
    set: !!goal,
  });
}

// PUT /api/finance/goal — create/update the goal for a year
// Body: { year?: number, targetAmount: number }
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const year = body.year ? parseInt(body.year) : new Date().getFullYear();
  const targetAmount = parseFloat(body.targetAmount);

  if (Number.isNaN(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: "Invalid targetAmount" }, { status: 400 });
  }

  const goal = await prisma.financialGoal.upsert({
    where: { year },
    update: { targetAmount },
    create: { year, targetAmount },
  });

  return NextResponse.json(goal);
}