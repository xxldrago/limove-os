// Yandex OAuth — общие утилиты (пункт G)
// Поток: authorize URL -> код -> обмен на токен -> refresh.

const CLIENT_ID = process.env.YANDEX_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET ?? "";
// После авторизации Яндекс редиректит сюда с ?code=
export const REDIRECT_URI = process.env.YANDEX_REDIRECT_URI ?? "https://oauth.yandex.ru/verification_code";

export const SCOPES = "metrika:read,webmaster:hostinfo,webmaster:verify"; // оба сервиса в одном токене

export interface YandexTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // секунды
  token_type?: string;
}

export function getClientCredentials() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("YANDEX_CLIENT_ID/YANDEX_CLIENT_SECRET не в .env");
  }
  return { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI };
}

// Ссылка, на которую отправляем пользователя для первого доступа
export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });
  return `https://oauth.yandex.ru/authorize?${params.toString()}`;
}

// Обменять authorization code на токен
export async function exchangeCode(code: string): Promise<YandexTokenData> {
  const creds = getClientCredentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Yandex token exchange failed ${res.status}: ${txt}`);
  }
  return (await res.json()) as YandexTokenData;
}

// Обновить истёкший access token через refresh_token
export async function refreshToken(refresh: string): Promise<YandexTokenData> {
  const creds = getClientCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Yandex token refresh failed ${res.status}: ${txt}`);
  }
  return (await res.json()) as YandexTokenData;
}

// Получить актуальный токен для аккаунта (восстановить если просрочен)
// restart-обёртка: если нужно держать refresh, передаём сохранённый refresh_token.
export async function ensureAccessToken(
  accessToken: string,
  refresh?: string | null,
  expiresAt?: Date | null
): Promise<{ accessToken: string; refresh?: string | null; expiresAt?: Date | null } | null> {
  const expired = expiresAt ? new Date(expiresAt).getTime() - Date.now() < 60_000 : true;
  if (!expired) {
    return { accessToken, refresh, expiresAt }; // ещё валиден
  }
  if (!refresh) {
    return null; // истёк, refresh нет — нужна повторная авторизация
  }
  try {
    const data = await refreshToken(refresh);
    const ex = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    return {
      accessToken: data.access_token,
      refresh: data.refresh_token ?? refresh,
      expiresAt: ex,
    };
  } catch {
    return null;
  }
}