// Яндекс Метрика API (пункт 2) — чтение счётчиков и статистики.

import { prisma } from "@/lib/prisma";
import { yandexGet } from "./client";
import { getDecryptedToken } from "./client";

const MGMT = "https://api-metrika.yandex.net/management/v1";
const STAT = "https://api-metrika.yandex.net/stat/v1";

export interface MetrikaCounterInfo {
  id: number;
  name: string;
  site: string;
}

/** Список доступных счётчиков аккаунта. */
export async function listCounters(token: string): Promise<MetrikaCounterInfo[]> {
  const data = (await yandexGet(`${MGMT}/counters`, token)) as {
    counters?: { id: number; name: string; site: string }[];
  } | null;
  if (!data?.counters) return [];
  return data.counters.map((c) => ({ id: c.id, name: c.name, site: c.site }));
}

interface DayStat {
  date: string;
  visits: number;
  users: number;
  pageviews: number;
  bounces: number;
  avgSec: number;
  goalReaches: number;
}

/**
 * Статистика по дням за период. Метрики: визиты, посетители, просмотры,
 * отказы, ср. время, суммарные достижения ЦЕЛИ (или целей).
 * @param goals список id целей (конверсия суммируется их достижениями).
 */
export async function fetchDailyStats(
  token: string,
  counterId: number,
  from: string, // YYYY-MM-DD
  to: string,   // YYYY-MM-DD
  goalIds: number[] = []
): Promise<DayStat[]> {
  const metrics = [
    "ym:s:visits",
    "ym:s:users",
    "ym:s:pageviews",
    "ym:s:bounces",
    "ym:s:avgVisitDurationSeconds",
  ];
  for (const g of goalIds) metrics.push(`ym:s:goal${g}Reaches`);

  // Stat API требует ids (мн. число); dimensions ym:s:date отдаёт дату в name.
  // БЕЗ group=day: с ним metrics приходят вложенными массивами.
  const params = new URLSearchParams({
    ids: String(counterId),
    metrics: metrics.join(","),
    dimensions: "ym:s:date",
    date1: from,
    date2: to,
    sort: "ym:s:date",
    accuracy: "full",
    limit: "100000",
  });

  const data = (await yandexGet(`${STAT}/data/bytime?${params.toString()}`, token)) as {
    data?: { dimensions?: { id?: string; name?: string }[]; metrics: number[] }[];
  } | null;
  if (!data?.data) return [];

  const out: DayStat[] = [];
  for (const row of data.data) {
    const date = row.dimensions?.[0]?.id ?? row.dimensions?.[0]?.name ?? "";
    const m = row.metrics;
    const goalIndex = goalIds.length > 0 ? metrics.indexOf("ym:s:bounces") + 1 : -1;
    // метрики идут в порядке запроса: [visits,users,pageviews,bounces,avgSec,...goals]
    const goalReaches =
      goalIds.length > 0 && goalIndex >= 0
        ? m.slice(5).reduce((a: number, b: number) => a + (b as number), 0)
        : 0;
    if (!date || !Array.isArray(m) || m.length === 0) continue;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    out.push({
      date,
      visits: Math.round(num(m[0])),
      users: Math.round(num(m[1])),
      pageviews: Math.round(num(m[2])),
      bounces: Math.round(num(m[3])),
      avgSec: Math.round(num(m[4])),
      goalReaches,
    });
  }
  return out;
}

/** Сохранить посуточные снимки в кеш БД (чтобы не дёргать API). */
export async function storeStatsCache(
  counterId: number,
  rows: DayStat[],
  goals: string[]
): Promise<void> {
  // upsert по (counterId, date): создаём или перезаписываем.
  for (const r of rows) {
    const date = new Date(r.date);
    const existing = await prisma.metricSnapshot.findFirst({
      where: { counterId, date: { gte: date, lte: date } } as never,
    });
    if (existing) {
      await prisma.metricSnapshot.update({
        where: { id: existing.id },
        data: {
          visits: r.visits,
          users: r.users,
          pageviews: r.pageviews,
          bounces: r.bounces,
          avgSec: r.avgSec,
          goalReaches: r.goalReaches,
          goals: goals.join(","),
        },
      });
    } else {
      await prisma.metricSnapshot.create({
        data: {
          counterId,
          date,
          visits: r.visits,
          users: r.users,
          pageviews: r.pageviews,
          bounces: r.bounces,
          avgSec: r.avgSec,
          goalReaches: r.goalReaches,
          goals: goals.join(","),
        },
      });
    }
  }
}

/** API прокси: данные за период с кешем. */
export async function getMetricData(
  tokenId: number,
  counterId: number,
  from: string,
  to: string,
  goalIds: number[] = []
): Promise<DayStat[]> {
  const token = await getDecryptedToken(tokenId);
  if (!token) throw new Error("Yandex токен не найден");

  // Проверим, есть ли свежие снимки за запрошенный период.
  const fromD = new Date(from);
  const toD = new Date(to);
  const cached = await prisma.metricSnapshot.findMany({
    where: { counterId, date: { gte: fromD, lte: toD } },
    orderBy: { date: "asc" },
  });
  // Если кол-во дней совпадает — отдаём кеш.
  const expectedDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  if (cached.length >= expectedDays && expectedDays > 1) {
    return cached.map((c) => ({
      date: c.date.toISOString().slice(0, 10),
      visits: c.visits,
      users: c.users,
      pageviews: c.pageviews,
      bounces: c.bounces,
      avgSec: c.avgSec,
      goalReaches: c.goalReaches,
    }));
  }

  // Иначе дёргаем API.
  const rows = await fetchDailyStats(token, counterId, from, to, goalIds);
  await storeStatsCache(counterId, rows, goalIds.map(String));
  return rows;
}

/** Получить список целей счётчика. */
export async function listGoals(token: string, counterId: number): Promise<{ id: number; name: string }[]> {
  const data = (await yandexGet(
    `${MGMT}/counter/${counterId}/goals`,
    token
  )) as { goals?: { id: number; name: string }[] } | null;
  return data?.goals ?? [];
}