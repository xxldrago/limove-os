import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/settings/telegram/chats — list registered chats
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, telegramChatId: true },
  });

  return NextResponse.json({
    chats: users.map((u) => ({ id: u.id, name: u.name, chatId: u.telegramChatId })),
  });
}