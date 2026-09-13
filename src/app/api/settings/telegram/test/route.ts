import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getBotAsync, telegramEnabled } from "@/lib/telegram-bot";

// POST /api/settings/telegram/test — send a test message to a chat (or all)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!telegramEnabled) {
    return NextResponse.json({ error: "Бот не настроен (нет токена)" }, { status: 400 });
  }

  let chatId: number | null = null;
  try {
    const body = await req.json();
    if (typeof body?.chatId === "number") chatId = body.chatId;
  } catch {
    /* body optional */
  }

  const bot = await getBotAsync();
  if (!bot) return NextResponse.json({ error: "Бот недоступен" }, { status: 500 });

  const users = chatId == null
    ? await prisma.user.findMany({ where: { telegramChatId: { not: null } } })
    : await prisma.user.findMany({ where: { telegramChatId: chatId } });

  if (users.length === 0) {
    return NextResponse.json({ error: "Нет зарегистрированных чатов" }, { status: 400 });
  }

  let sent = 0;
  const sentTo: string[] = [];
  for (const u of users) {
    if (!u.telegramChatId) continue;
    try {
      await bot.api.sendMessage(u.telegramChatId, "✅ Тестовое сообщение от Limove OS");
      sent++;
      sentTo.push(`${u.name} (${u.telegramChatId})`);
    } catch (e) {
      console.error(`[telegram] test message to ${u.telegramChatId} failed:`, e);
    }
  }

  return NextResponse.json({ ok: true, sent, sentTo });
}