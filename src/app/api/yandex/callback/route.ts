import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/yandex/oauth";

/**
 * GET /api/yandex/callback?code=...&state=...
 * Обменивает код на токен, шифрует и сохраняет в БД, редиректит на проект.
 * state — JSON { service, projectId } (см. /api/yandex/connect).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateRaw = searchParams.get("state");

  const parse = () => {
    try {
      return stateRaw ? JSON.parse(decodeURIComponent(stateRaw)) : {};
    } catch {
      return {};
    }
  };
  const { service, projectId } = parse();

  const home = `/connect?status=${error ? "error" : "ok"}&service=${service ?? "METRIKA"}&projectId=${projectId ?? ""}`;

  if (error || !code) {
    return NextResponse.redirect(new URL(home, req.url));
  }

  try {
    const tokenData = await exchangeCode(code);
    await prisma.yandexToken.create({
      data: {
        service: service === "WEBMASTER" ? "WEBMASTER" : "METRIKA",
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
      },
    });
    return NextResponse.redirect(new URL(`/connect?status=ok&service=${service ?? "METRIKA"}&projectId=${projectId ?? ""}`, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(new URL(`/connect?status=error&message=${encodeURIComponent(msg)}`, req.url));
  }
}