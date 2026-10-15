import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getBotAsync, getEffectiveToken, telegramEnabled, TELEGRAM_API_ROOT, TELEGRAM_UA } from "@/lib/telegram-bot";
import { Bot } from "grammy";

// GET /api/settings/telegram — status + config (never the raw token)
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getEffectiveToken();
  const enabled = telegramEnabled || token.length > 0;

  let botUsername: string | null = null;
  let connected = false;
  if (enabled) {
    try {
      const bot = await getBotAsync();
      if (bot) {
        const me = await bot.api.getMe();
        botUsername = me.username || null;
        connected = true;
      }
    } catch (e) {
      console.error("[telegram] getMe failed:", e);
    }
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, telegramChatId: true },
  });

  return NextResponse.json({
    enabled,
    connected,
    hasToken: token.length > 0,
    botUsername,
    users,
  });
}

// POST /api/settings/telegram — save token + hot-restart bot (expects { token }).
// Persists to DB (survives redeploys) and restarts the running bot in place,
// so Save takes effect immediately without a container restart.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = (body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Токен пуст" }, { status: 400 });

  // Test connection with the new token via a throwaway Bot instance.
  let botUsername: string | null = null;
  try {
    const testBot = new Bot(token, { client: { apiRoot: TELEGRAM_API_ROOT, baseFetchConfig: { headers: { "User-Agent": TELEGRAM_UA } } } });
    const me = await testBot.api.getMe();
    botUsername = me.username || null;
  } catch (e) {
    console.error("[telegram] connection test failed:", e);
    return NextResponse.json({ error: "Неверный токен: бот не отвечает" }, { status: 400 });
  }

  // Persist + restart the live bot.
  try {
    const { setBotToken } = await import("@/lib/telegram-bot");
    await setBotToken(token);
  } catch (e) {
    console.error("[telegram] failed to persist/restart bot:", e);
    return NextResponse.json(
      { error: "Токен верный, но не удалось запустить бота. Перезапустите контейнер." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, botUsername, restarted: true });
}
