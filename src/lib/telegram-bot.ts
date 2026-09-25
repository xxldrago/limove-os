import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";
import {
  computePartnerBalance,
  LESHA_ID,
  GENA_ID,
  PLACEHOLDER_EMAIL,
} from "@/lib/finance-balance";

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

/** True when a valid token is configured so the bot may start. */
export const telegramEnabled = TELEGRAM_BOT_TOKEN.trim().length > 0;

const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function fmtMoney(n: number): string {
  return RUB.format(Math.round(n));
}

function monthName(d: Date): string {
  return d.toLocaleDateString("ru-RU", { month: "long" });
}

async function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, now };
}

function formatDurationMs(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return `${hours} ч ${rem} мин`;
  const days = Math.floor(hours / 24);
  return `${days} дн ${hours % 24} ч`;
}

// ================= COMMAND IMPLEMENTATIONS =================

async function buildStatusMessage(): Promise<string> {
  const { start, end, now } = await currentMonthRange();
  const tx = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { type: true, amount: true, paidById: true },
  });

  let income = 0, expense = 0;
  const perUser: Record<number, number> = {};
  for (const t of tx) {
    const amt = Number(t.amount);
    if (t.type === "INCOME") income += amt;
    else if (t.type === "EXPENSE") expense += amt;
    if (t.type === "EXPENSE") perUser[t.paidById] = (perUser[t.paidById] || 0) + amt;
  }
  const profit = income - expense;

  const users = await prisma.user.findMany();
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const placeholder = users.find((u) => u.email === PLACEHOLDER_EMAIL);

  const lines: string[] = [];
  lines.push(`📊 Сводка за ${monthName(now)}`);
  lines.push("");
  lines.push(`💰 Приход: ${fmtMoney(income)} ₽`);
  lines.push(`💸 Расход: ${fmtMoney(expense)} ₽`);
  lines.push(`📈 Прибыль: ${fmtMoney(profit)} ₽`);
  lines.push("");
  for (const [uid, amt] of Object.entries(perUser)) {
    // Технический пользователь «—» — не партнёр, в сводке не показываем.
    if (placeholder && Number(uid) === placeholder.id) continue;
    lines.push(`👥 ${nameById.get(Number(uid)) || `#${uid}`} потратил: ${fmtMoney(amt)} ₽`);
  }
  return lines.join("\n");
}

async function buildBalanceMessage(): Promise<string> {
  const { start, end } = await currentMonthRange();
  const tx = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { type: true, amount: true, paidById: true },
  });

  // Та же модель, что в панели (computePartnerBalance): доли 50/50 от
  // позиций партнёров, технический пользователь «—» не влияет на долг.
  const b = computePartnerBalance(tx, LESHA_ID, GENA_ID);
  if (Math.abs(b.debt) < 0.01) return "✅ Баланс равен";

  const users = await prisma.user.findMany({
    where: { id: { in: [LESHA_ID, GENA_ID] } },
    select: { id: true, name: true },
  });
  const nameOf = (id: number, fallback: string) =>
    users.find((u) => u.id === id)?.name ?? fallback;
  const debtor = b.debt > 0 ? nameOf(LESHA_ID, "Лёша") : nameOf(GENA_ID, "Гена");
  const creditor = b.debt > 0 ? nameOf(GENA_ID, "Гена") : nameOf(LESHA_ID, "Лёша");
  return `${debtor} должен ${creditor} ${fmtMoney(Math.abs(b.debt))} ₽`;
}

async function buildExpiringMessage(): Promise<string> {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const domains = await prisma.domainRecord.findMany({
    where: { expiresAt: { lte: in7, gte: now } },
    include: { project: { select: { name: true } } },
  });
  const vpns = await prisma.vpnSubscription.findMany({
    where: { expiresAt: { lte: in7, gte: now }, status: "ACTIVE" },
  });

  if (domains.length === 0 && vpns.length === 0) {
    return "✅ Ничего не истекает в ближайшие 7 дней";
  }

  const lines: string[] = ["⏰ Истекающие (7 дней)"];
  if (domains.length > 0) {
    lines.push("", "🌐 Домены:");
    for (const d of domains) {
      const days = Math.max(0, Math.ceil((d.expiresAt.getTime() - now.getTime()) / 86400000));
      const proj = d.project?.name ? ` (${d.project.name})` : "";
      lines.push(`• ${d.value}${proj} — истекает через ${days} дн.`);
    }
  }
  if (vpns.length > 0) {
    lines.push("", "🔑 VPN:");
    for (const v of vpns) {
      const days = Math.max(0, Math.ceil((v.expiresAt!.getTime() - now.getTime()) / 86400000));
      lines.push(`• ${v.provider} / ${v.clientName} — истекает через ${days} дн.`);
    }
  }
  return lines.join("\n");
}

async function buildDownMessage(): Promise<string> {
  // Только активные — как в панели (дашборд и /monitoring показывают
  // упавшими лишь isActive && isError).
  const sites = await prisma.siteMonitor.findMany({ where: { isError: true, isActive: true } });
  if (sites.length === 0) return "✅ Все сайты работают";

  const now = Date.now();
  const lines: string[] = ["🔴 Упавшие сайты:"];
  for (const s of sites) {
    let dur = "неизвестно";
    if (s.downSince) {
      const ms = now - s.downSince.getTime();
      if (ms > 0) dur = formatDurationMs(ms);
    }
    lines.push(`• ${s.url.replace(/^https?:\/\//, "")} (${s.name}) — в дауне ${dur}`);
  }
  return lines.join("\n");
}

// ================= REGISTRATION =================

/** Claim a chat_id for a partner based on who started the bot. */
async function registerChatId(username: string, firstName: string, lastName: string, chatId: number) {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  // Try exact first-name / last-name / username match on an unclaimed partner.
  const nameParts = [firstName, lastName, username].filter(Boolean);
  for (const part of nameParts) {
    if (!part) continue;
    const match = users.find(
      (u) => !u.telegramChatId && u.name.toLowerCase() === part.toLowerCase()
    );
    if (match) {
      await prisma.user.update({ where: { id: match.id }, data: { telegramChatId: chatId } });
      console.log(`[telegram] chat ${chatId} bound to ${match.name}`);
      return;
    }
  }

  // Fallback: bind the first partner with no chatId yet.
  const freeUser = users.find((u) => !u.telegramChatId);
  if (freeUser) {
    await prisma.user.update({ where: { id: freeUser.id }, data: { telegramChatId: chatId } });
    console.log(`[telegram] chat ${chatId} bound to ${freeUser.name} (fallback)`);
  }
}

function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const chatId = ctx.chat?.id;
    const firstName = from.first_name || "";
    const lastName = from.last_name || "";

    if (chatId) {
      await registerChatId(from.username || "", firstName, lastName, chatId);
    }

    await ctx.reply(
      `Привет, ${firstName}${lastName ? " " + lastName : ""}! 🤖\n\n` +
        `Я бот Limove OS. Мои команды:\n` +
        `/status — сводка за месяц\n` +
        `/balance — баланс партнёров\n` +
        `/expiring — истекающие домены и VPN\n` +
        `/down — упавшие сайты\n` +
        `/help — список команд`
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      `Доступные команды:\n` +
        `/status — сводка за месяц (приход/расход/прибыль)\n` +
        `/balance — баланс партнёров (кто кому должен)\n` +
        `/expiring — домены и VPN, истекающие за 7 дней\n` +
        `/down — сайты, которые сейчас упали\n` +
        `/help — список команд`
    );
  });

  bot.command("status", async (ctx) => {
    try {
      await ctx.reply(await buildStatusMessage());
    } catch (e) {
      await safeCatch(ctx, e, "/status");
    }
  });

  bot.command("balance", async (ctx) => {
    try {
      await ctx.reply(await buildBalanceMessage());
    } catch (e) {
      await safeCatch(ctx, e, "/balance");
    }
  });

  bot.command("expiring", async (ctx) => {
    try {
      await ctx.reply(await buildExpiringMessage());
    } catch (e) {
      await safeCatch(ctx, e, "/expiring");
    }
  });

  bot.command("down", async (ctx) => {
    try {
      await ctx.reply(await buildDownMessage());
    } catch (e) {
      await safeCatch(ctx, e, "/down");
    }
  });
}

async function safeCatch(ctx: { reply: (t: string) => Promise<unknown> }, e: unknown, cmd: string) {
  console.error(`[telegram] error in ${cmd}:`, e);
  try {
    await ctx.reply("⚠️ Произошла ошибка при выполнении команды. Попробуйте позже.");
  } catch {
    /* ignore downstream reply failure */
  }
}

// ================= SINGLETON =================

let _bot: Bot | null = null;
let _botPromise: Promise<Bot> | null = null;

/** Async access to the singleton bot instance, or null when disabled. */
export async function getBotAsync(): Promise<Bot | null> {
  if (!telegramEnabled) return null;
  if (_bot) return _bot;
  if (!_botPromise) {
    _botPromise = (async () => {
      const bot = new Bot(TELEGRAM_BOT_TOKEN);
      registerCommands(bot);
      try {
        await bot.api.setMyCommands([
          { command: "status", description: "Сводка за месяц" },
          { command: "balance", description: "Баланс партнёров" },
          { command: "expiring", description: "Истекающие домены и VPN" },
          { command: "down", description: "Упавшие сайты" },
          { command: "help", description: "Список команд" },
        ]);
      } catch (e) {
        console.warn("[telegram] setMyCommands failed:", e);
      }
      _bot = bot;
      return bot;
    })();
  }
  return _botPromise;
}