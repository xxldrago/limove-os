import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildAuthorizeUrl, getClientCredentials } from "@/lib/yandex/oauth";

/**
 * GET и POST /api/yandex/connect?service=METRIKA|WEBMASTER&projectId=N
 * Возвращает URL для авторизации (открывается в новой вкладке).
 * GET нужен, т.к. клиент (tab-analytics) открывает URL обычным fetch без method.
 */
export async function POST(req: NextRequest) {
  return connect(req);
}

export async function GET(req: NextRequest) {
  return connect(req);
}

async function connect(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") ?? "METRIKA";
  const projectId = searchParams.get("projectId");

  try {
    getClientCredentials();
  } catch {
    return NextResponse.json(
      {
        error:
          "Не настроена Яндекс-авторизация: задайте YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET и YANDEX_REDIRECT_URI в .env (приложение создаётся на oauth.yandex.ru).",
      },
      { status: 400 }
    );
  }

  const url = buildAuthorizeUrl();
  // Добавляем state, чтобы при callback понять, к какому проекту привязать.
  const state = encodeURIComponent(
    JSON.stringify({ service, projectId: projectId ? Number(projectId) : null })
  );
  const finalUrl = `${url}&state=${state}`;

  return NextResponse.json({ url: finalUrl });
}