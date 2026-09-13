import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDecryptedToken } from "@/lib/yandex/client";
import { listCounters } from "@/lib/yandex/metrika";
import { getUserId, listHosts } from "@/lib/yandex/webmaster";

/**
 * GET /api/yandex/list?service=METRIKA|WEBMASTER
 * Возвращает доступные счётчики/хосты из сохранённых токенов.
 * data: массив { id/number, label } для выбора в UI.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") ?? "METRIKA";

  const tokens = await prisma.yandexToken.findMany({ where: { service } });
  if (tokens.length === 0) {
    return NextResponse.json({ data: [], needOAuth: true, items: [] });
  }

  const items: { tokenId: number; id: string; label: string }[] = [];

  for (const tok of tokens) {
    const token = await getDecryptedToken(tok.id);
    if (!token) continue;
    try {
      if (service === "WEBMASTER") {
        const uid = await getUserId(token);
        const hosts = await listHosts(token, uid);
        for (const h of hosts) {
          items.push({ tokenId: tok.id, id: h.hostId, label: h.hostUrl });
        }
      } else {
        const counters = await listCounters(token);
        for (const c of counters) {
          items.push({ tokenId: tok.id, id: String(c.id), label: `${c.name} (${c.site})` });
        }
      }
    } catch (e) {
      // токен невалиден/ошибка — пропускаем
      continue;
    }
  }

  return NextResponse.json({ data: items, needOAuth: items.length === 0, items });
}