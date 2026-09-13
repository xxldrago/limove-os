// Формирование аналитических отчётов (пункт B, D)
// Сводка по проектам: маржа, прогноз, флаги трафик-дроп, топ-запросы.

import { prisma } from "@/lib/prisma";

/** Маржинальность/рейтинг проектов (пункт D). */
export async function getProjectMargins() {
  const projects = await prisma.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: {
      id: true,
      slug: true,
      name: true,
      transactions: {
        select: { type: true, amount: true },
      },
    },
  });

  const rows = projects.map((p) => {
    let income = 0;
    let expense = 0;
    for (const t of p.transactions) {
      const amt = Number(t.amount);
      if (t.type === "INCOME") income += amt;
      else expense += amt;
    }
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      income,
      expense,
      margin: income - expense,
      marginPct: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    };
  });

  rows.sort((a, b) => b.margin - a.margin);
  return rows;
}

/** Прогноз vs годовая цель (пункт D). */
export async function getAnnualForecast() {
  const year = new Date().getFullYear();
  const goal = await prisma.financialGoal.findFirst({ where: { year } });
  const goalAmt = goal?.targetAmount ? Number(goal.targetAmount) : 0;

  // Доход за текущий год
  const startOfYear = new Date(year, 0, 1);
  const txns = await prisma.transaction.findMany({
    where: { type: "INCOME", date: { gte: startOfYear } },
    select: { amount: true, date: true },
  });
  const incomeYTD = txns.reduce((a, t) => a + Number(t.amount), 0);

  // Средний доход в месяц (учёт только прошедших месяцев года)
  const now = new Date();
  const monthsElapsed = Math.max(1, now.getMonth() + 1);
  const avgMonthly = incomeYTD / monthsElapsed;
  const monthsLeft = 12 - (now.getMonth() + 1);
  const forecast = incomeYTD + avgMonthly * monthsLeft;

  return {
    year,
    goal: goalAmt,
    incomeYTD,
    forecast,
    monthsLeft,
    projectedMet: goalAmt > 0 && forecast >= goalAmt,
    shortfall: goalAmt > 0 && forecast < goalAmt ? goalAmt - forecast : 0,
  };
}

/** Флаги «трафик упал» по проектам с Метрикой (пункт D). */
export async function getTrafficDropFlags() {
  const counters = await prisma.yandexMetricCounter.findMany({
    include: { project: { select: { name: true, slug: true } } },
  });
  const now = new Date();
  const since = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  const flags: { projectName: string; slug: string; dropPct: number }[] = [];
  for (const c of counters) {
    const recentSnap = await prisma.metricSnapshot.aggregate({
      where: { counterId: c.counterId, date: { gte: since(7), lte: now } },
      _sum: { visits: true },
    });
    const prevSnap = await prisma.metricSnapshot.aggregate({
      where: { counterId: c.counterId, date: { gte: since(14), lt: since(7) } },
      _sum: { visits: true },
    });
    const recent = recentSnap._sum.visits ?? 0;
    const prev = prevSnap._sum.visits ?? 0;
    if (prev > 20 && recent < prev * 0.8) {
      const drop = Math.round((1 - recent / prev) * 100);
      flags.push({ projectName: c.project.name, slug: c.project.slug, dropPct: drop });
    }
  }
  return flags;
}

/** Сводка по проекту за месяц для отчёта (пункт 4/B). */
export async function getProjectMonthSummary(
  projectId: number,
  year: number,
  month: number
) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const txns = await prisma.transaction.findMany({
    where: { projectId, date: { gte: start, lt: end } },
    select: { type: true, amount: true },
  });
  let income = 0, expense = 0;
  for (const t of txns) {
    if (t.type === "INCOME") income += Number(t.amount);
    else expense += Number(t.amount);
  }

  const counter = await prisma.yandexMetricCounter.findUnique({ where: { projectId } });
  let metric = null;
  if (counter) {
    const snap = await prisma.metricSnapshot.aggregate({
      where: { counterId: counter.counterId, date: { gte: start, lt: end } },
      _sum: { visits: true, users: true, goalReaches: true },
    });
    metric = {
      visits: snap._sum.visits ?? 0,
      users: snap._sum.users ?? 0,
      goalReaches: snap._sum.goalReaches ?? 0,
    };
  }

  const host = await prisma.yandexWebmasterHost.findUnique({ where: { projectId } });

  return {
    projectId,
    income,
    expense,
    margin: income - expense,
    metric,
    hasMetric: !!counter,
    hasWebmaster: !!host,
  };
}

/** Военно-чистая функция: собрать текст ежемесячного отчёта (пункт B). */
export async function buildMonthlyReportText(year: number, month: number): Promise<string> {
  const projects = await prisma.project.findMany({ where: { status: { not: "ARCHIVED" } } });
  const monthName = new Date(year, month).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const lines: string[] = [];
  lines.push(`📊 Отчёт за ${monthName}`);
  lines.push("");

  let any = false;
  for (const p of projects) {
    const s = await getProjectMonthSummary(p.id, year, month);
    if (!s.hasMetric && !s.hasWebmaster && s.income === 0 && s.expense === 0) continue;
    any = true;
    lines.push(`▪️ ${p.name}`);
    if (s.metric) {
      lines.push(`   👥 Визиты: ${s.metric.visits.toLocaleString("ru-RU")} · Посетители: ${s.metric.users.toLocaleString("ru-RU")} · Конверсии: ${s.metric.goalReaches}`);
    } else {
      lines.push(`   Метрика не подключена`);
    }
    lines.push(`   💰 Доход: ${s.income.toLocaleString("ru-RU")} ₽ · Расходы: ${s.expense.toLocaleString("ru-RU")} ₽ · Профит: ${s.margin.toLocaleString("ru-RU")} ₽`);
    lines.push("");
  }

  if (!any) {
    lines.push("Нет данных по проектам за этот месяц.");
  }

  // Флаги трафик-дроп
  const flags = await getTrafficDropFlags();
  if (flags.length > 0) {
    lines.push("⚠️ Падение трафика:");
    for (const f of flags) lines.push(`   🔴 ${f.projectName} −${f.dropPct}% (7 дней к предыдущим)`);
  }

  // Прогноз цели
  const fc = await getAnnualForecast();
  if (fc.goal > 0) {
    lines.push("");
    lines.push(`🎯 Цель года: ${fc.incomeYTD.toLocaleString("ru-RU")} ₽ из ${fc.goal.toLocaleString("ru-RU")} ₽`);
    lines.push(fc.projectedMet
      ? `   ✅ Прогноз достигнет цели (${Math.round(fc.forecast).toLocaleString("ru-RU")} ₽)`
      : `   ⚠️ Прогноз ниже цели: ${Math.round(fc.shortfall).toLocaleString("ru-RU")} ₽ не хватает`);
  }

  return lines.join("\n");
}