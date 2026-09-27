import { prisma } from "@/lib/prisma";
import { getBotAsync, telegramEnabled } from "@/lib/telegram-bot";

const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const fmt = (n: number) => RUB.format(Math.round(n));

// Asia/Krasnoyarsk = UTC+7 (без летнего времени).
const KRAS_OFFSET_MS = 7 * 3600 * 1000;

function krasNow(now = new Date()): Date {
  return new Date(now.getTime() + KRAS_OFFSET_MS);
}

/** Ключ недели (понедельник) для дедупа, напр. «2026-W39». */
function weekKey(now = new Date()): string {
  const k = krasNow(now);
  // Откатываемся к понедельнику недели.
  const day = k.getUTCDay(); // 0=вс..6=сб
  const back = (day + 6) % 7;
  const monday = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - back));
  const y = monday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week = 1 + Math.round((monday.getTime() - jan4.getTime()) / (7 * 86400000));
  return `${y}-W${week}`;
}

/** Сейчас понедельник 9:00–9:59 по Красноярску? */
function isDigestTime(now = new Date()): boolean {
  const k = krasNow(now);
  return k.getUTCDay() === 1 && k.getUTCHours() === 9;
}

export async function buildWeeklyDigestText(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const tx = await prisma.transaction.findMany({
    where: { date: { gte: weekAgo } },
    select: { type: true, amount: true, category: true },
  });
  let income = 0, expense = 0;
  const byCat: Record<string, number> = {};
  for (const t of tx) {
    const a = Number(t.amount);
    if (t.type === "INCOME") income += a;
    else if (t.type === "EXPENSE") {
      expense += a;
      byCat[t.category] = (byCat[t.category] || 0) + a;
    }
  }

  const [invNew, invPaid, down, domains, vpns, servers] = await Promise.all([
    prisma.invoice.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({ where: { status: "PAID", paidDate: { gte: weekAgo } } }),
    prisma.siteMonitor.count({ where: { isActive: true, isError: true } }),
    prisma.domainRecord.count({ where: { expiresAt: { lte: in7, gte: now } } }),
    prisma.vpnSubscription.count({
      where: { expiresAt: { lte: in7, gte: now }, status: "ACTIVE" },
    }),
    prisma.server.count({ where: { paidUntil: { lte: in7, gte: now } } }),
  ]);

  const topCats = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const lines = [
    `📰 Дайджест недели`,
    ``,
    `💰 Приход: ${fmt(income)} ₽`,
    `💸 Расход: ${fmt(expense)} ₽`,
    `📈 Сальдо: ${fmt(income - expense)} ₽`,
    ``,
  ];
  if (topCats.length > 0) {
    lines.push(`Топ расходов:`);
    for (const [cat, sum] of topCats) lines.push(`• ${cat}: ${fmt(sum)} ₽`);
    lines.push(``);
  }
  lines.push(`📄 Неоплаченных счетов: ${invNew} · оплачено за неделю: ${invPaid}`);
  lines.push(
    `${down > 0 ? `🔴 Упавших сайтов: ${down}` : `🟢 Сайты в порядке`}`
  );
  if (domains + vpns + servers > 0) {
    lines.push(`⏰ Истекает за 7 дней: доменов ${domains}, VPN ${vpns}, серверов ${servers}`);
  }
  return lines.join("\n");
}

/**
 * Отправить еженедельный дайджест (понедельник ~9:00 Красноярск).
 * Идемпотентен: ключ недели хранится в БД, переживает рестарты.
 */
export async function runWeeklyDigest(now = new Date()): Promise<string> {
  if (!telegramEnabled) return "disabled";
  if (!isDigestTime(now)) return "not-time";
  const key = weekKey(now);

  const already = await prisma.notification.findFirst({
    where: { type: "DIGEST", content: key },
  });
  if (already) return "already";

  const bot = await getBotAsync();
  if (!bot) return "no-bot";
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  const chats = [...new Set(users.map((u) => u.telegramChatId!).filter(Boolean))];
  if (chats.length === 0) return "no-chats";

  const text = await buildWeeklyDigestText();
  for (const chatId of chats) {
    try {
      await bot.api.sendMessage(chatId, text);
    } catch (e) {
      console.error(`[telegram] digest to ${chatId} failed:`, e);
    }
  }
  await prisma.notification.create({
    data: { type: "DIGEST", title: "Еженедельный дайджест", content: key, sentToTg: true },
  });
  return "sent";
}

const g = globalThis as Record<string, unknown>;

/** Почасовая проверка времени дайджеста. */
export function startWeeklyDigestService() {
  if (!telegramEnabled) return;
  if (g.__digestStarted) return;
  g.__digestStarted = true;
  const run = () =>
    runWeeklyDigest().catch((e) => console.error("[telegram] digest error:", e));
  run();
  g.__digestTimer = setInterval(run, 60 * 60 * 1000);
}
