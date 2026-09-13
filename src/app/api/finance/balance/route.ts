import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

  // Get all transactions for the month
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    select: {
      type: true,
      amount: true,
      paidById: true,
    },
  });

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;
  let leshaExpenses = 0;
  let genaExpenses = 0;
  let debtSettled = false;

  for (const t of transactions) {
    const amt = Number(t.amount);
    if (t.type === "DEBT_SETTLEMENT") {
      // Debt settlement writes off debts between partners: balances become equal.
      debtSettled = true;
    } else if (t.type === "INCOME") {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      if (t.paidById === 1) leshaExpenses += amt;
      if (t.paidById === 2) genaExpenses += amt;
    }
  }

  const partnerShare = totalIncome / 2;
  let leshaBalance = partnerShare - leshaExpenses;
  let genaBalance = partnerShare - genaExpenses;

  // If debts were settled this month, both balances are equalized at the average.
  if (debtSettled) {
    const avg = (leshaBalance + genaBalance) / 2;
    leshaBalance = avg;
    genaBalance = avg;
  }

  return NextResponse.json({
    month: `${year}-${String(mon).padStart(2, "0")}`,
    totalIncome,
    totalExpenses,
    profit: totalIncome - totalExpenses,
    settled: debtSettled,
    partners: {
      lesha: {
        name: "Лёша",
        share: partnerShare,
        spent: leshaExpenses,
        balance: leshaBalance,
      },
      gena: {
        name: "Гена",
        share: partnerShare,
        spent: genaExpenses,
        balance: genaBalance,
      },
    },
  });
}
