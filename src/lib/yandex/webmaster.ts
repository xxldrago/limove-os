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
  const data = (await yandexGet(`${WB}/user/`, token, 2)) as { user_id?: string } | null;
  return data?.user_id ?? "";
}

/** Статистика поисковых запросов за период (по дням). */
export async function fetchQueryStats(
  token: string,
  userId: string,
  hostId: string,
  from: string,
  to: string
): Promise<{ date: string; shows: number; clicks: number; position: number }[]> {
  const params = new URLSearchParams({
    query_indicator: "TOTAL_SHOWS,TOTAL_CLICKS,AVG_SHOW_POSITION,AVG_CLICK_POSITION",
    date_from: from,
    date_to: to,
    limit: "1000",
  });
  const data = (await yandexGet(
    `${WB}/user/${userId}/hosts/${hostId}/search-history?${params.toString()}`,
    token
  )) as { data?: { date?: string; values?: { name?: string; value?: string }[] }[] } | null;
  if (!data?.data) return [];

  return data.data.map((row) => {
    const vals: Record<string, number> = {};
    for (const v of row.values ?? []) {
      if (v.name) vals[v.name] = parseFloat(v.value ?? "0");
    }
    return {
      date: row.date ?? "",
      shows: Math.round(vals.SHOWS ?? 0),
      clicks: Math.round(vals.CLICKS ?? 0),
      position: Math.round(vals.AVG_SHOW_POSITION ?? 0),
    };
  });
}

/** Топ-запросы за период (для отчётов клиенту). */
export async function fetchTopQueries(
  token: string,
  userId: string,
  hostId: string,
  from: string,
  to: string
): Promise<{ query: string; shows: number; clicks: number; position: number }[]> {
  const params = new URLSearchParams({
    query_indicator: "TOTAL_SHOWS,TOTAL_CLICKS,AVG_SHOW_POSITION",
    date_from: from,
    date_to: to,
    limit: "50",
    order_by: "TOTAL_SHOWS",
    order_direction: "DESCENDING",
  });
  const data = (await yandexGet(
    `${WB}/user/${userId}/hosts/${hostId}/top-queries?${params.toString()}`,
    token
  )) as { queries?: { query: string; indicators: { name?: string; value?: string }[] }[] } | null;
  if (!data?.queries) return [];

  return data.queries.map((q) => {
    const vals: Record<string, number> = {};
    for (const ind of q.indicators ?? []) {
      if (ind.name) vals[ind.name] = parseFloat(ind.value ?? "0");
    }
    return {
      query: q.query,
      shows: Math.round(vals.SHOWS ?? 0),
      clicks: Math.round(vals.CLICKS ?? 0),
      position: Math.round(vals.AVG_SHOW_POSITION ?? 0),
    };
  });
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