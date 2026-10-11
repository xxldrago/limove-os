import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  computePartnerBalance,
  ensurePlaceholderUserId,
  LESHA_ID,
  GENA_ID,
} from "@/lib/finance-balance";

/**
 * POST /api/finance/settle-debts
 * Гашение СКВОЗНОГО долга между партнёрами (долг не привязан к месяцу:
 * копится по всем операциям, пока не погашен полностью).
 *
 * Body:
 *   { mode?: "full" | "partial" | "skip",
 *     person?: "lesha" | "gena", amount?: number }
 *
 * - full    — погасить весь текущий сквозной долг (DEBT_SETTLEMENT на всю сумму)
 * - partial — частичное погашение: person = кто получил деньги (кредитор),
 *             amount = сколько получил; долг уменьшается на эту сумму
 * - skip    — ничего не делать
 *
 * Запись DEBT_SETTLEMENT датируется моментом погашения и в сквозном расчёте
 * обнуляет (full) или уменьшает (partial) накопленный долг. На приход/расход
 * не влияет.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    mode?: "full" | "partial" | "skip";
    person?: "lesha" | "gena";
    amount?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const mode = body.mode ?? "full";

  if (mode === "skip") {
    return NextResponse.json({ skipped: true, settled: false });
  }

  // Сквозной остаток — по ВСЕМ операциям за всё время.
  const [transactions, users] = await Promise.all([
    prisma.transaction.findMany({
      select: { type: true, amount: true, paidById: true, date: true, id: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
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

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const outstanding = Math.abs(b.debt);
  if (outstanding < 0.01) {
    return NextResponse.json({ alreadyEqual: true, settled: true, month: monthKey, remainingDebt: 0 });
  }

  // Кто кому должен (по знаку долга): debt > 0 → Лёша должен Гене
  const debtor = b.debt > 0 ? leshaName : genaName;
  const creditor = b.debt > 0 ? genaName : leshaName;

  // Сумма к погашению
  let amount: number;
  if (mode === "partial") {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Укажите сумму больше нуля" }, { status: 400 });
    }
    // Частичное гашение не может превысить текущий долг
    amount = Math.min(amount, outstanding);
    // Кто получил — кредитор; если выбрали не того, всё равно гасим долг на сумму
    const receiver = body.person === "gena" ? genaName : body.person === "lesha" ? leshaName : null;
    if (receiver && receiver === debtor) {
      return NextResponse.json(
        { error: `Деньги должен получить ${creditor}, а не ${debtor}` },
        { status: 400 }
      );
    }
  } else {
    amount = outstanding;
  }

  const placeholderId = await ensurePlaceholderUserId();

  await prisma.transaction.create({
    data: {
      type: "DEBT_SETTLEMENT",
      amount,
      description:
        mode === "partial"
          ? `Частичное погашение долга: ${debtor} → ${creditor}`
          : `Погашение долга: ${debtor} → ${creditor}`,
      paidById: placeholderId, // в истории партнёр отображается как «—»
      category: "Расчёт",
      date: now,
    },
  });

  // Новый остаток долга после погашения
  const remainingDebt = Math.max(0, Math.round((outstanding - amount) * 100) / 100);
  const num = amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return NextResponse.json({
    settled: true,
    skipped: false,
    alreadyEqual: false,
    month: monthKey,
    mode,
    amount,
    debtor,
    creditor,
    remainingDebt,
    message:
      mode === "partial"
        ? `Частично погашено ${num}₽ (${debtor} → ${creditor}). Остаток долга: ${remainingDebt.toLocaleString("ru-RU")}₽`
        : `Долг ${num}₽ (${debtor} → ${creditor}) погашен`,
  });
}
