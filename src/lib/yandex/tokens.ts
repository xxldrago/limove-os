import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/yandex/oauth";

/**
 * Обмен кода авторизации на токен и сохранение в БД (шифр AES-256).
 * Общая логика для OAuth-редиректа (/api/yandex/callback)
 * и ручного ввода кода (/api/yandex/token).
 * Возвращает id сохранённого токена.
 */
export async function saveYandexTokenFromCode(
  code: string,
  service: string
): Promise<number> {
  const tokenData = await exchangeCode(code.trim());
  const saved = await prisma.yandexToken.create({
    data: {
      service: service === "WEBMASTER" ? "WEBMASTER" : "METRIKA",
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
    },
  });
  return saved.id;
}
