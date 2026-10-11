import { prisma } from '@/lib/prisma';

/**
 * Единая модель партнёрского баланса.
 *
 * Все деньги делятся 50/50. Долг — СКВОЗНОЙ, без привязки к месяцу:
 * копится по всем операциям за всё время, пока не погашен.
 * Погашение (DEBT_SETTLEMENT) уменьшает текущий долг; после полного
 * погашения накопление начинается с нуля.
 *
 * Знак долга:
 *   debt > 0  → Лёша должен Гене
 *   debt < 0  → Гена должен Лёше
 *
 * Погашения (DEBT_SETTLEMENT) не влияют на приход/расход.
 *
 * ВАЖНО: чтобы долг считался сквозным, сюда нужно передавать ВСЕ транзакции
 * (с датой), а не срез за месяц. Срезы по месяцам используются только для
 * отображения статистики месяца (приход/расход/доли) — долг всегда берётся
 * из сквозного расчёта.
 */

export const PLACEHOLDER_EMAIL = '-@limove.local';
export const LESHA_ID = 1;
export const GENA_ID = 2;

export interface TxLike {
  type: string;
  amount: unknown;
  paidById: number;
  /** Дата операции — для сквозного долга важен хронологический порядок. */
  date?: Date | string;
  /** Tiebreak при одинаковой дате. */
  id?: number;
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
  genaId: number = GENA_ID,
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

    if (t.type === 'DEBT_SETTLEMENT') {
      if (amt > 0) settledAmount += amt;
      continue;
    }

    if (t.type === 'INCOME') {
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

  // --- Сквозной долг: идём строго в хронологическом порядке. ---
  // Каждая операция двигает долг на половину суммы (доли 50/50):
  //   INCOME Лёши +A/2 (Лёша удержал общее → его долг растёт)
  //   INCOME Гены −A/2
  //   EXPENSE Лёши −A/2 (Лёша вложил своё → его долг падает)
  //   EXPENSE Гены +A/2
  // Деньги мимо партнёров (получатель «—») на долг не влияют.
  // DEBT_SETTLEMENT гасит текущий остаток; переплата разворачивает долг.
  const ordered = txs
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const da = a.t.date ? new Date(a.t.date).getTime() : NaN;
      const db = b.t.date ? new Date(b.t.date).getTime() : NaN;
      const aDated = !Number.isNaN(da);
      const bDated = !Number.isNaN(db);
      if (!aDated && !bDated) return a.i - b.i;
      if (!aDated) return 1;
      if (!bDated) return -1;
      if (da !== db) return da - db;
      return (a.t.id ?? a.i) - (b.t.id ?? b.i);
    });

  let debt = 0;
  for (const { t } of ordered) {
    const amt = Number(t.amount);
    if (!Number.isFinite(amt)) continue;

    if (t.type === 'DEBT_SETTLEMENT') {
      if (amt <= 0 || Math.abs(debt) < 1e-9) continue; // гасить нечего
      if (amt >= Math.abs(debt)) {
        const over = amt - Math.abs(debt);
        debt = debt > 0 ? -over : over;
      } else {
        debt += debt > 0 ? -amt : amt;
      }
      continue;
    }

    const half = amt / 2;
    if (t.type === 'INCOME') {
      if (t.paidById === leshaId) debt += half;
      else if (t.paidById === genaId) debt -= half;
    } else {
      if (t.paidById === leshaId) debt -= half;
      else if (t.paidById === genaId) debt += half;
    }
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
    `SELECT setval(pg_get_serial_sequence("User", "id"), COALESCE((SELECT MAX(id) FROM "User"), 1))`
  );

  const created = await prisma.user.create({
    data: {
      name: '—',
      email: PLACEHOLDER_EMAIL,
      passwordHash: 'DISABLED_NO_LOGIN',
      role: 'partner',
    },
  });
  return created.id;
}
