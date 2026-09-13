import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * POST /api/finance/settle-debts
 * Writes off partner debts for a given month (or the current month).
 * Records a lightweight DEBT_SETTLEMENT transaction so the balance route
 * equalizes both partners' balances for that month going forward.
 * Body: { month?: "YYYY-MM" } (optional; defaults to current month).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { month?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let year: number;
  let mon: number;
  const month = body.month;
  if (month && /^\d{4}-\d{1,2}$/.test(month)) {
    [year, mon] = month.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    mon = now.getMonth() + 1;
  }

  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);

  // Same per-month balance computation as the balance route.
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

  let totalIncome = 0;
  let leshaExpenses = 0;
  let genaExpenses = 0;

  for (const t of transactions) {
    const amt = Number(t.amount);
    if (t.type === "INCOME") {
      totalIncome += amt;
    } else if (t.type !== "DEBT_SETTLEMENT") {
      if (t.paidById === 1) leshaExpenses += amt;
      if (t.paidById === 2) genaExpenses += amt;
    }
  }

  const partnerShare = totalIncome / 2;
  const leshaBalance = partnerShare - leshaExpenses;
  const genaBalance = partnerShare - genaExpenses;
  const diff = leshaBalance - genaBalance;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.01) {
    return NextResponse.json({
      alreadyEqual: true,
      settled: true,
      month: `${year}-${String(mon).padStart(2, "0")}`,
    });
  }

  const debtor = diff < 0 ? "Лёша" : "Гена";
  const creditor = diff < 0 ? "Гена" : "Лёша";

  await prisma.transaction.create({
    data: {
      type: "DEBT_SETTLEMENT",
      amount: absDiff,
      description: `Погашение долга: ${debtor} → ${creditor} (${absDiff}₽)`,
      paidById: diff < 0 ? 1 : 2, // debtor party id (lesha=1, gena=2)
      category: "Расчёт",
      date: new Date(year, mon - 1, Math.min(new Date().getDate(), end.getDate())),
    },
  });

  const num = absDiff.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return NextResponse.json({
    settled: true,
    alreadyEqual: false,
    month: `${year}-${String(mon).padStart(2, "0")}`,
    amount: absDiff,
    debtor,
    creditor,
    message: `Долг ${debtor} → ${creditor} (${num}₽) погашен`,
  });
}