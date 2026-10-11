import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { computePartnerBalance, LESHA_ID, GENA_ID } from "@/lib/finance-balance";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  // Default to current month
  let year: number;
  let mon: number;
  if (month) {
    [year, mon] = month.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    mon = now.getMonth() + 1;
  }

  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);

  const [monthTxs, allTxs, users] = await Promise.all([
    // Статистика месяца — только для витрины (приход/расход/доли).
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      select: { type: true, amount: true, paidById: true },
    }),
    // Долг — СКВОЗНОЙ: все операции за всё время, в хронологическом порядке.
    prisma.transaction.findMany({
      select: { type: true, amount: true, paidById: true, date: true, id: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({
      where: { id: { in: [LESHA_ID, GENA_ID] } },
      select: { id: true, name: true },
    }),
  ]);

  const m = computePartnerBalance(monthTxs, LESHA_ID, GENA_ID);
  const cumulative = computePartnerBalance(allTxs, LESHA_ID, GENA_ID);

  const nameOf = (id: number, fallback: string) =>
    users.find((u) => u.id === id)?.name ?? fallback;
  const leshaName = nameOf(LESHA_ID, "Лёша");
  const genaName = nameOf(GENA_ID, "Гена");

  // Долг не зависит от выбранного месяца.
  const debtor = cumulative.debt > 0 ? leshaName : genaName;
  const creditor = cumulative.debt > 0 ? genaName : leshaName;

  return NextResponse.json({
    month: `${year}-${String(mon).padStart(2, "0")}`,
    totalIncome: m.totalIncome,
    totalExpenses: m.totalExpenses,
    profit: m.profit,
    settled: m.settledAmount > 0,
    settledAmount: m.settledAmount,
    debt: Math.abs(cumulative.debt),
    debtor,
    creditor,
    partners: {
      lesha: {
        name: leshaName,
        share: m.lesha.share,
        spent: m.lesha.spent,
        received: m.lesha.received,
        net: m.lesha.net,
        balance: m.lesha.net,
      },
      gena: {
        name: genaName,
        share: m.gena.share,
        spent: m.gena.spent,
        received: m.gena.received,
        net: m.gena.net,
        balance: m.gena.net,
      },
    },
  });
}
