// Яндекс Вебмастер API (пункт 3) — хосты, запросы, позиции, предупреждения.

import { prisma } from "@/lib/prisma";
import { yandexGet } from "./client";
import { getDecryptedToken } from "./client";

const WB = "https://api.webmaster.yandex.net/v4";

export interface WbHost {
  hostId: string;
  hostUrl: string;
  verified: boolean;
  asciiHostUrl: string;
}

/** Список хостов (сайтов) аккаунта Вебмастера. */
export async function listHosts(token: string, userId: string): Promise<WbHost[]> {
  const data = (await yandexGet(`${WB}/user/${userId}/hosts`, token)) as {
    hosts?: {
      host_id: string;
      ascii_host_url: string;
      unicode_host_url?: string;
      verified: boolean;
    }[];
  } | null;
  if (!data?.hosts) return [];
  return data.hosts.map((h) => ({
    hostId: h.host_id,
    // В API v4 нет поля host_url — только ascii_host_url и unicode_host_url.
    hostUrl: h.unicode_host_url || h.ascii_host_url,
    verified: h.verified,
    asciiHostUrl: h.ascii_host_url,
  }));
}

// Получить user_id из токена: POST https://api.webmaster.yandex.net/v4/user/
export async function getUserId(token: string): Promise<string> {
  const data = (await yandexGet(`${WB}/user/`, token, 2)) as { user_id?: string | number } | null;
  // API отдаёт user_id числом (int64), в БД храним строкой.
  return String(data?.user_id ?? "");
}

/** Статистика поисковых запросов за период (по дням). */
export async function fetchQueryStats(
  token: string,
  userId: string,
  hostId: string,
  from: string,
  to: string
): Promise<{ date: string; shows: number; clicks: number; position: number }[]> {
  // Реальный эндпоинт v4: search-queries/all/history (search-history не существует).
  // query_indicator можно повторять; URLSearchParams соберёт их через запятую —
  // API принимает и такой формат.
  const params = new URLSearchParams({
    date_from: from,
    date_to: to,
  });
  for (const ind of ["TOTAL_SHOWS", "TOTAL_CLICKS", "AVG_SHOW_POSITION"]) {
    params.append("query_indicator", ind);
  }
  const data = (await yandexGet(
    `${WB}/user/${userId}/hosts/${hostId}/search-queries/all/history?${params.toString()}`,
    token
  )) as {
    indicators?: Record<string, { date: string; value: number }[]>;
  } | null;
  if (!data?.indicators) return [];

  const byDate = new Map<string, { shows: number; clicks: number; position: number }>();
  const put = (date: string, key: "shows" | "clicks" | "position", value: number) => {
    const day = date.slice(0, 10);
    const cur = byDate.get(day) ?? { shows: 0, clicks: 0, position: 0 };
    cur[key] = value;
    byDate.set(day, cur);
  };
  for (const p of data.indicators.TOTAL_SHOWS ?? []) put(p.date, "shows", Number(p.value));
  for (const p of data.indicators.TOTAL_CLICKS ?? []) put(p.date, "clicks", Number(p.value));
  for (const p of data.indicators.AVG_SHOW_POSITION ?? [])
    put(p.date, "position", Number(p.value));

  return [...byDate.entries()]
    .map(([date, v]) => ({
      date,
      shows: Math.round(v.shows),
      clicks: Math.round(v.clicks),
      position: Math.round(v.position * 10) / 10,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Топ-запросы за период (для отчётов клиенту). */
export async function fetchTopQueries(
  token: string,
  userId: string,
  hostId: string,
  from: string,
  to: string
): Promise<{ query: string; shows: number; clicks: number; position: number }[]> {
  // Реальный эндпоинт v4: search-queries/popular (top-queries не существует).
  // query_indicator передаётся повторяющимся параметром, запятая не валидна.
  const params = new URLSearchParams({
    order_by: "TOTAL_SHOWS",
    date_from: from,
    date_to: to,
    limit: "10",
  });
  for (const ind of ["TOTAL_SHOWS", "TOTAL_CLICKS", "AVG_SHOW_POSITION"]) {
    params.append("query_indicator", ind);
  }
  const data = (await yandexGet(
    `${WB}/user/${userId}/hosts/${hostId}/search-queries/popular?${params.toString()}`,
    token
  )) as {
    queries?: {
      query_text: string;
      indicators?: Record<string, number>;
    }[];
  } | null;
  if (!data?.queries) return [];

  return data.queries.map((q) => ({
    query: q.query_text,
    shows: Math.round(Number(q.indicators?.TOTAL_SHOWS ?? 0)),
    clicks: Math.round(Number(q.indicators?.TOTAL_CLICKS ?? 0)),
    position: Math.round(Number(q.indicators?.AVG_SHOW_POSITION ?? 0)),
  }));
}

/** Позиции по введённым ключам (пункт A) — берём из top-queries Вебмастера. */
export async function fetchKeywordPositions(
  token: string,
  userId: string,
  hostId: string,
  keywords: string[]
): Promise<{ keyword: string; position: number; shows: number; clicks: number }[]> {
  const top = await fetchTopQueries(token, userId, hostId, "today-1m", "today");
  const map = new Map(top.map((t) => [t.query.toLowerCase(), t]));
  return keywords
    .map((k) => {
      const hit = map.get(k.toLowerCase());
      return {
        keyword: k,
        position: hit?.position ?? 0, // 0 = не найдено в топе
        shows: hit?.shows ?? 0,
        clicks: hit?.clicks ?? 0,
      };
    });
}

/** Сохранить снимки позиций по ключам. */
export async function storePositionCache(projectId: number, rows: { keyword: string; position: number }[]): Promise<void> {
  for (const r of rows) {
    const kw = await prisma.trackedKeyword.findFirst({ where: { projectId, keyword: r.keyword } });
    if (!kw) continue;
    // Снимок на сегодня (перезапись за текущий день вместо дублей).
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const existing = await prisma.positionSnapshot.findFirst({
      where: { projectId, keywordId: kw.id, date: { gte: startOfDay, lte: endOfDay } },
    });
    if (existing) {
      await prisma.positionSnapshot.update({
        where: { id: existing.id },
        data: { position: r.position || null },
      });
    } else {
      await prisma.positionSnapshot.create({
        data: { projectId, keywordId: kw.id, date: new Date(), position: r.position || null, shows: 0, clicks: 0 },
      });
    }
  }
}