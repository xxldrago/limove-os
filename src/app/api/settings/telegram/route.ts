import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getBotAsync, telegramEnabled, TELEGRAM_BOT_TOKEN } from "@/lib/telegram-bot";
import { Bot } from "grammy";

// GET /api/settings/telegram — status + config (not the raw token)
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let botUsername: string | null = null;
  let connected = false;
  if (telegramEnabled) {
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
    enabled: telegramEnabled,
    connected,
    hasToken: TELEGRAM_BOT_TOKEN.trim().length > 0,
    botUsername,
    users,
  });
}

// POST /api/settings/telegram — save token + test connection (expects { token })
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

  // Persist to .env so the running container picks it up on next deploy.
  try {
    const fs = await import("fs");
    const path = await import("path");
    const envPath = path.join(process.cwd(), ".env");
    let envText = "";
    if (fs.existsSync(envPath)) {
      envText = fs.readFileSync(envPath, "utf-8");
    }
    const line = (key: string, value: string) => `${key}="${value.replace(/"/g, '\\"')}"`;
    if (new RegExp(`^${"TELEGRAM_BOT_TOKEN"}="?"`, "m").test(envText)) {
      envText = envText.replace(
        /^TELEGRAM_BOT_TOKEN="?[^"]*"?$/m,
        line("TELEGRAM_BOT_TOKEN", token)
      );
    } else {
      envText += `\n${line("TELEGRAM_BOT_TOKEN", token)}`;
    }
    fs.writeFileSync(envPath, envText, "utf-8");
  } catch (e) {
    console.error("[telegram] failed to write .env:", e);
    return NextResponse.json(
      { error: "Не удалось сохранить токен в .env. Проверьте права." },
      { status: 500 }
    );
  }

  // Test connection with the new token via a throwaway Bot instance.
  let botUsername: string | null = null;
  try {
    const testBot = new Bot(token);
    const me = await testBot.api.getMe();
    botUsername = me.username || null;
  } catch (e) {
    console.error("[telegram] connection test failed:", e);
    return NextResponse.json({ error: "Неверный токен: бот не отвечает" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, botUsername });
}