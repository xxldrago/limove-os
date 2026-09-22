import { prisma } from "@/lib/prisma";

/**
 * Единая модель партнёрского баланса.
 *
 * Логика: каждый партнёр имеет долю прибыли (profit / 2). Сравниваем её с его
 * фактической позицией (получил − потратил). Кто держит больше своей доли —
 * тот должен второму разницу.
 *
 *   debt > 0  → Лёша должен Гене
 *   debt < 0  → Гена должен Лёше
 *
 * Погашения (DEBT_SETTLEMENT) уменьшают величину долга, не влияя на приход/расход.
 */

export const PLACEHOLDER_EMAIL = "-@limove.local";
export const LESHA_ID = 1;
export const GENA_ID = 2;

export interface TxLike {
  type: string;
  amount: unknown;
  paidById: number;
}

export interface PartnerSide {
  received: number;
  spent: number;
  share: number;
  net: number;
}

export interface PartnerBalanceResult {
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  settledAmount: number;
  /** > 0 — Лёша должен Гене; < 0 — Гена должен Лёше */
  debt: number;
  lesha: PartnerSide;
  gena: PartnerSide;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePartnerBalance(
  txs: TxLike[],
  leshaId: number = LESHA_ID,
  genaId: number = GENA_ID
): PartnerBalanceResult {
  let totalIncome = 0;
  let totalExpenses = 0;
  let settledAmount = 0;
  let leshaReceived = 0;
  let genaReceived = 0;
  let leshaSpent = 0;
  let genaSpent = 0;

  for (const t of txs) {
    const amt = Number(t.amount);
    if (!Number.isFinite(amt)) continue;

    if (t.type === "DEBT_SETTLEMENT") {
      settledAmount += amt;
      continue;
    }

    if (t.type === "INCOME") {
      totalIncome += amt;
      if (t.paidById === leshaId) leshaReceived += amt;
      else if (t.paidById === genaId) genaReceived += amt;
    } else {
      totalExpenses += amt;
      if (t.paidById === leshaId) leshaSpent += amt;
      else if (t.paidById === genaId) genaSpent += amt;
    }
  }

  const profit = totalIncome - totalExpenses;
  const share = profit / 2;

  const leshaNet = leshaReceived - leshaSpent;
  const genaNet = genaReceived - genaSpent;

  // Долг между партнёрами — это только деньги, прошедшие через них лично.
  // Нераспределённые суммы (получатель «—») на долг между партнёрами не влияют.
  // «Позиция» = сколько партнёр внёс из своего кармана сверх того, что забрал.
  const leshaPosition = leshaSpent - leshaReceived;
  const genaPosition = genaSpent - genaReceived;

  // Кто внёс больше — тому второй должен половину разницы (доли 50/50).
  //   > 0 → Лёша должен Гене
  //   < 0 → Гена должен Лёше
  let debt = (genaPosition - leshaPosition) / 2;

  if (settledAmount > 0) {
    const magnitude = Math.max(0, Math.abs(debt) - settledAmount);
    debt = debt < 0 ? -magnitude : magnitude;
  }

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    profit: round2(profit),
    settledAmount: round2(settledAmount),
    debt: round2(debt),
    lesha: { received: round2(leshaReceived), spent: round2(leshaSpent), share: round2(share), net: round2(leshaNet) },
    gena: { received: round2(genaReceived), spent: round2(genaSpent), share: round2(share), net: round2(genaNet) },
  };
}

/** Возвращает id технического пользователя «—» (создаёт при необходимости). */
export async function ensurePlaceholderUserId(): Promise<number> {
  const existing = await prisma.user.findUnique({ where: { email: PLACEHOLDER_EMAIL } });
  if (existing) return existing.id;

  // Seed вставляет пользователей с явными id, из-за чего sequence может отставать.
  // Выравниваем её перед вставкой без id, иначе получим конфликт по первичному ключу.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX(id) FROM "User"), 1))`
  );

  const created = await prisma.user.create({
    data: {
      name: "—",
      email: PLACEHOLDER_EMAIL,
      passwordHash: "DISABLED_NO_LOGIN",
      role: "partner",
    },
  });
  return created.id;
}
