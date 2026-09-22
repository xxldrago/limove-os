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

  const [transactions, users] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      select: { type: true, amount: true, paidById: true },
    }),
    prisma.user.findMany({
      where: { id: { in: [LESHA_ID, GENA_ID] } },
      select: { id: true, name: true },
    }),
  ]);

  const b = computePartnerBalance(transactions, LESHA_ID, GENA_ID);

  const nameOf = (id: number, fallback: string) =>
    users.find((u) => u.id === id)?.name ?? fallback;
  const leshaName = nameOf(LESHA_ID, "Лёша");
  const genaName = nameOf(GENA_ID, "Гена");

  const debtor = b.debt > 0 ? leshaName : genaName;
  const creditor = b.debt > 0 ? genaName : leshaName;

  return NextResponse.json({
    month: `${year}-${String(mon).padStart(2, "0")}`,
    totalIncome: b.totalIncome,
    totalExpenses: b.totalExpenses,
    profit: b.profit,
    settled: b.settledAmount > 0,
    settledAmount: b.settledAmount,
    debt: Math.abs(b.debt),
    debtor,
    creditor,
    partners: {
      lesha: {
        name: leshaName,
        share: b.lesha.share,
        spent: b.lesha.spent,
        received: b.lesha.received,
        net: b.lesha.net,
        balance: b.lesha.net,
      },
      gena: {
        name: genaName,
        share: b.gena.share,
        spent: b.gena.spent,
        received: b.gena.received,
        net: b.gena.net,
        balance: b.gena.net,
      },
    },
  });
}
