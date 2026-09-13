// Формирование данных для отчёта клиенту (пункт 4).
import { prisma } from "@/lib/prisma";
import { getDecryptedToken } from "@/lib/yandex/client";
import { fetchTopQueries } from "@/lib/yandex/webmaster";

export interface ReportMetricRow {
  day: number;
  visits: number;
  users: number;
  pageviews: number;
  goalReaches: number;
}

export interface ReportData {
  project: { id: number; name: string; slug: string; description: string | null };
  period: { year: number; month: number; monthName: string };
  metric: {
    hasMetric: boolean;
    totalVisits: number;
    totalUsers: number;
    totalPageviews: number;
    totalGoals: number;
    convRate: number;
    avgVisitsPerDay: number;
    daily: ReportMetricRow[];
  };
  webmaster: {
    hasWebmaster: boolean;
    topQueries: { query: string; shows: number; clicks: number; position: number }[];
    totalFromSearch: number;
  };
  finance: {
    income: number;
    expense: number;
    margin: number;
  };
  generatedAt: string;
}

/** Собрать данные отчёта за месяц. Месяц: 0-индексный. */
export async function buildReportData(projectId: number, year: number, month: number): Promise<ReportData> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!project) throw new Error("Проект не найден");

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  // --- Метрика ---
  const counter = await prisma.yandexMetricCounter.findUnique({ where: { projectId } });
  let metric = {
    hasMetric: false,
    totalVisits: 0,
    totalUsers: 0,
    totalPageviews: 0,
    totalGoals: 0,
    convRate: 0,
    avgVisitsPerDay: 0,
    daily: [] as ReportMetricRow[],
  };

  if (counter) {
    const snaps = await prisma.metricSnapshot.findMany({
      where: { counterId: counter.counterId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
    const totalVisits = snaps.reduce((a, s) => a + s.visits, 0);
    const totalUsers = snaps.reduce((a, s) => a + s.users, 0);
    const totalPageviews = snaps.reduce((a, s) => a + s.pageviews, 0);
    const totalGoals = snaps.reduce((a, s) => a + s.goalReaches, 0);
    const daysInMonth = snaps.length || new Date(year, month + 1, 0).getDate();
    metric = {
      hasMetric: true,
      totalVisits,
      totalUsers,
      totalPageviews,
      totalGoals,
      convRate: totalVisits > 0 ? (totalGoals / totalVisits) * 100 : 0,
      avgVisitsPerDay: daysInMonth > 0 ? totalVisits / daysInMonth : 0,
      daily: snaps.map((s) => ({
        day: s.date.getDate(),
        visits: s.visits,
        users: s.users,
        pageviews: s.pageviews,
        goalReaches: s.goalReaches,
      })),
    };
  }

  // --- Вебмастер ---
  const host = await prisma.yandexWebmasterHost.findUnique({ where: { projectId } });
  let webmaster = {
    hasWebmaster: false,
    topQueries: [] as { query: string; shows: number; clicks: number; position: number }[],
    totalFromSearch: 0,
  };

  if (host && host.tokenId) {
    const token = await getDecryptedToken(host.tokenId);
    if (token) {
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
      try {
        const top = await fetchTopQueries(token, host.userId, host.hostId, from, to);
        webmaster = {
          hasWebmaster: true,
          topQueries: top.slice(0, 10),
          totalFromSearch: top.reduce((a, q) => a + q.clicks, 0),
        };
      } catch {
        // вебмастер недоступен — оставляем пустым
      }
    }
  }

  // --- Финансы ---
  const txns = await prisma.transaction.findMany({
    where: { projectId, date: { gte: start, lt: end } },
    select: { type: true, amount: true },
  });
  let income = 0, expense = 0;
  for (const t of txns) {
    if (t.type === "INCOME") income += Number(t.amount);
    else expense += Number(t.amount);
  }

  const monthName = new Date(year, month).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return {
    project: { id: project.id, name: project.name, slug: project.slug, description: project.description },
    period: { year, month, monthName },
    metric,
    webmaster,
    finance: { income, expense, margin: income - expense },
    generatedAt: new Date().toISOString(),
  };
}