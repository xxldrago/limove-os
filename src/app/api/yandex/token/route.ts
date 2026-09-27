import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { saveYandexTokenFromCode } from "@/lib/yandex/tokens";

/**
 * POST /api/yandex/token { code, service }
 * Ручной ввод кода с https://oauth.yandex.ru/verification_code
 * (когда в приложении Яндекса зашит verification_code и редирект не поменять).
 * Обменивает код на токен, сохраняет шифрованным, возвращает tokenId.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = (body.code as string)?.trim();
  const service = body.service === "WEBMASTER" ? "WEBMASTER" : "METRIKA";

  if (!code) {
    return NextResponse.json({ error: "Вставьте код с страницы Яндекса" }, { status: 400 });
  }

  try {
    const tokenId = await saveYandexTokenFromCode(code, service);
    return NextResponse.json({ ok: true, tokenId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Яндекс отклонил код: ${msg}` },
      { status: 400 }
    );
  }
}
