import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * GET /api/finance/categories?month=YYYY-MM&type=EXPENSE
 * Разбивка по категориям за месяц — для Fernbrook-метров на странице Финансы.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const type = (searchParams.get("type") || "EXPENSE").toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE";

  let year: number;
  let mon: number;
  if (month && /^\d{4}-\d{1,2}$/.test(month)) {
    [year, mon] = month.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    mon = now.getMonth() + 1;
  }

  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);

  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    where: { type, date: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const total = grouped.reduce((acc, g) => acc + Number(g._sum.amount ?? 0), 0);

  return NextResponse.json({
    month: `${year}-${String(mon).padStart(2, "0")}`,
    type,
    total,
    categories: grouped.map((g) => {
      const amount = Number(g._sum.amount ?? 0);
      return {
        category: g.category,
        amount,
        count: g._count._all,
        pct: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      };
    }),
  });
}
