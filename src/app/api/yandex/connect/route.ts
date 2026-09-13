import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildAuthorizeUrl } from "@/lib/yandex/oauth";

/**
 * POST /api/yandex/connect?service=METRIKA|WEBMASTER&projectId=N
 * Возвращает URL для авторизации (открывается в новой вкладке).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") ?? "METRIKA";
  const projectId = searchParams.get("projectId");

  const url = buildAuthorizeUrl();
  // Добавляем state, чтобы при callback понять, к какому проекту привязать.
  const state = encodeURIComponent(
    JSON.stringify({ service, projectId: projectId ? Number(projectId) : null })
  );
  const finalUrl = `${url}&state=${state}`;

  return NextResponse.json({ url: finalUrl });
}