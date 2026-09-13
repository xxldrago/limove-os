// Обёртка API Яндекса с ретраями и кешированием (пункт G).

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

const RETRY_STATUSES = [429, 500, 502, 503, 504];

/** Дождаться и повторить при 429/5xx, ограниченное число раз. */
async function fetchWithRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, init);
    if (!RETRY_STATUSES.includes(res.status)) return res;
    lastRes = res;
    // backoff: 1s, 2s, 4s
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  return lastRes!;
}

/** Извлечь рабочий токен из БД по id, пере-шифруя при refresh. */
export async function getDecryptedToken(tokenId: number): Promise<string | null> {
  const rec = await prisma.yandexToken.findUnique({ where: { id: tokenId } });
  if (!rec) return null;
  try {
    return decrypt(rec.accessToken);
  } catch {
    return null;
  }
}

/**
 * Выполнить GET к Yandex API с Bearer-токеном и ретраями.
 * Вернёт json или null при ошибке авторизации (401/403).
 */
export async function yandexGet(
  url: string,
  token: string,
  tries = 3
): Promise<unknown | null> {
  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      Authorization: `OAuth ${token}`,
      "Content-Type": "application/json",
    },
  }, tries);

  if (res.status === 401 || res.status === 403) return null; // токен невалиден
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Yandex GET ${res.status}: ${url} ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export { fetchWithRetry };