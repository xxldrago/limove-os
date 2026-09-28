import { prisma } from "@/lib/prisma";
import { getBotAsync, telegramEnabled } from "@/lib/telegram-bot";
import { buildMonthlyReportText } from "@/lib/analytics-report";
import { startWeeklyDigestService } from "@/lib/weekly-digest";

/**
 * Format a Notification record as a Telegram-ready text message.
 * Handles INVOICE / RECEIPT / MONITOR / DOMAIN / VPN / TASK types.
 * Falls back to a generic preview for unknown types.
 */
export function formatNotification(n: {
  title: string;
  content: string;
  type: string;
  createdAt: Date;
}): string {
  const content = (n.content || "").trim();
  const lines: string[] = [];

  switch (n.type) {
    case "INVOICE":
      lines.push(`📄 Новый счёт: ${n.title}`);
      break;
    case "RECEIPT":
      lines.push(`✅ Счёт оплачен: ${n.title}`);
      break;
    case "MONITOR":
      // content usually already contains "🔴 Сайт УПАЛ: ..." — forward title + content
      if (/упал|down|восстановлен/i.test(n.title)) {
        lines.push(n.title);
      } else {
        lines.push(`🔔 ${n.title}`);
      }
      break;
    case "DOMAIN":
      lines.push(`🌐 ${n.title}`);
      break;
    case "VPN":
      lines.push(`🔑 ${n.title}`);
      break;
    case "SERVER":
      lines.push(`🖥️ ${n.title}`);
      break;
    case "TASK":
      lines.push(`📋 ${n.title}`);
      break;
    default:
      lines.push(n.title);
  }

  if (content && content.length > 0) {
    lines.push(content);
  }

  return lines.join("\n");
}

/**
 * Send all unsent notifications to registered partner chats.
 * Groups by chat id so each pending notification reaches an available chat.
 * Marks each as sentToTg once delivered.
 *
 * Serialized via an in-process mutex: the 30s loop, the daily cron and the
 * receipt reminders all call this function, and without serialization two
 * overlapping runs would read the same `sentToTg: false` rows and send
 * every notification twice.
 */
let _sendChain: Promise<unknown> = Promise.resolve();

export function sendPendingNotifications(): Promise<number> {
  const run = _sendChain.then(() => _sendPendingNotificationsInner());
  // Keep the chain alive even if one run fails.
  _sendChain = run.catch(() => 0);
  return run;
}

async function _sendPendingNotificationsInner() {
  if (!telegramEnabled) return 0;
  const bot = await getBotAsync();
  if (!bot) return 0;

  const pending = await prisma.notification.findMany({
    where: { sentToTg: false },
    orderBy: { id: "asc" },
  });
  if (pending.length === 0) return 0;

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, name: true, telegramChatId: true },
  });
  if (users.length === 0) return 0;

  const chatByPartner: Record<number, number> = {};
  for (const u of users) if (u.telegramChatId) chatByPartner[u.id] = u.telegramChatId;

  let sent = 0;
  for (const notif of pending) {
    // Prefer notifications that already carry a partner chat via tgFileId (not
    // relevant here) — forward to the first registered chat with a partner link.
    const targets = Object.values(chatByPartner);
    if (targets.length === 0) break;

    const text = formatNotification(notif);
    for (const chatId of targets) {
      try {
        if (notif.tgFileId) {
          await bot.api.sendDocument(chatId, notif.tgFileId, { caption: text });
        } else {
          await bot.api.sendMessage(chatId, text);
        }
        sent++;
      } catch (e) {
        console.error(`[telegram] send to ${chatId} failed (notif #${notif.id}):`, e);
      }
    }
    await prisma.notification.update({
      where: { id: notif.id },
      data: { sentToTg: true },
    });
  }
  return sent;
}

// ================= DAILY CRON ALERTS =================

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whether a DOMAIN/VPN/TASK alert was already created today (avoids dups). */
async function alreadyNotifiedToday(type: string): Promise<boolean> {
  const start = startOfTodayUtc();
  const count = await prisma.notification.count({
    where: {
      type,
      createdAt: { gte: start },
    },
  });
  return count > 0;
}

/** «16 дней», «1 день», «3 дня» — как в карточках проектов. */
function daysWord(n: number): string {
  const d = Math.max(0, Math.ceil(n));
  const m10 = d % 10, m100 = d % 100;
  const w = m10 === 1 && m100 !== 11 ? "день" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "дня" : "дней";
  return `${d} ${w}`;
}

async function ensureNotification(type: string, title: string, content: string) {
  // Dedupe by exact (type, title, content-is-today) best-effort within the day.
  const start = startOfTodayUtc();
  const dup = await prisma.notification.findFirst({
    where: { type, title, createdAt: { gte: start } },
  });
  if (dup) return;
  await prisma.notification.create({ data: { type, title, content } });
}

/**
 * Check for upcoming domain/vpn expiry and overdue tasks, creating
 * Notifications once per day. Safe to call repeatedly — dedupes to one per day.
 */
export async function runDailyExpiryAlerts() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  try {
    // Domains expiring within their reminderDays window.
    const domains = await prisma.domainRecord.findMany({ include: { project: { select: { name: true } } } });
    if (!(await alreadyNotifiedToday("DOMAIN"))) {
      let any = false;
      for (const d of domains) {
        const daysLeft = (d.expiresAt.getTime() - now.getTime()) / 86400000;
        if (daysLeft >= 0 && daysLeft <= d.reminderDays) {
          const label = d.name || d.value;
          await ensureNotification(
            "DOMAIN",
            `🌐 ${label} истекает через ${daysWord(daysLeft)}`,
            `${label}${d.project?.name ? ` (${d.project.name})` : ""} — продлить до ${d.expiresAt.toLocaleDateString("ru-RU")}.`
          );
          any = true;
        }
      }
      if (any) console.log("[telegram] daily: created domain expiry alerts");
    }

    // VPN expiring within 7 days.
    const vpns = await prisma.vpnSubscription.findMany({ where: { status: "ACTIVE" } });
    if (!(await alreadyNotifiedToday("VPN"))) {
      let any = false;
      for (const v of vpns) {
        if (!v.expiresAt) continue;
        const daysLeft = (v.expiresAt.getTime() - now.getTime()) / 86400000;
        if (daysLeft >= 0 && daysLeft <= 7) {
          await ensureNotification(
            "VPN",
            `🔑 ${v.provider} / ${v.clientName} истекает через ${daysWord(daysLeft)}`,
            `${v.provider} / ${v.clientName} — продлить до ${v.expiresAt.toLocaleDateString("ru-RU")}.`
          );
          any = true;
        }
      }
      if (any) console.log("[telegram] daily: created vpn expiry alerts");
    }

    // Servers with payment expiring within 7 days.
    const servers = await prisma.server.findMany({ where: { paidUntil: { not: null } } });
    if (!(await alreadyNotifiedToday("SERVER"))) {
      let any = false;
      for (const s of servers) {
        if (!s.paidUntil) continue;
        const daysLeft = (s.paidUntil.getTime() - now.getTime()) / 86400000;
        if (daysLeft >= 0 && daysLeft <= 7) {
          await ensureNotification(
            "SERVER",
            `🖥️ ${s.name} истекает через ${daysWord(daysLeft)}`,
            `${s.name} — продлить до ${s.paidUntil.toLocaleDateString("ru-RU")}.`
          );
          any = true;
        }
      }
      if (any) console.log("[telegram] daily: created server expiry alerts");
    }

    // Overdue, not-done tasks.
    const tasks = await prisma.task.findMany({
      where: { dueDate: { lt: now }, status: { not: "DONE" } },
      include: { project: { select: { name: true } } },
    });
    if (!(await alreadyNotifiedToday("TASK"))) {
      let any = false;
      for (const t of tasks) {
        await ensureNotification(
          "TASK",
          `📋 Просрочена задача: ${t.title}`,
          `${t.project?.name ? `Проект: ${t.project.name}\n` : ""}Срок был до ${t.dueDate!.toLocaleDateString("ru-RU")}.`
        );
        any = true;
      }
      if (any && tasks.length) console.log("[telegram] daily: created overdue task alerts");
    }
  } catch (e) {
    console.error("[telegram] daily expiry alerts failed:", e);
  }

  // Push whatever was created to Telegram.
  await sendPendingNotifications();
}

// ================= RECEIPT REMINDERS =================

/**
 * Send daily Telegram reminders for invoices marked PAID but without a receipt,
 * starting 2 days after paidDate. Message format:
 *   «Нет чека на сумму {amount}₽ от {date} (счёт {invoiceNumber}).
 *    Пожалуйста загрузите чек.»
 * Dedupes to one notification per invoice per day via the content match.
 */
export async function runReceiptReminders() {
  if (!telegramEnabled) return 0;

  const now = new Date();
  const startOfDay = startOfTodayUtc();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);

  const payed = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      paidDate: { not: null, lte: twoDaysAgo },
      OR: [{ receiptFile: null }, { receiptFile: "" }],
    },
  });

  let created = 0;
  for (const inv of payed) {
    const invNum = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
    const dateStr = (inv.paidDate ?? inv.createdAt).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const text = `Нет чека на сумму ${Math.round(Number(inv.amount))}₽ от ${dateStr} (счёт ${invNum}). Пожалуйста загрузите чек.`;

    // One reminder per invoice per day.
    const dup = await prisma.notification.findFirst({
      where: { type: "RECEIPT", content: text, createdAt: { gte: startOfDay } },
    });
    if (dup) continue;

    await prisma.notification.create({
      data: { type: "RECEIPT", title: "⏰ Напоминание о чеке", content: text, sentToTg: false },
    });
    created++;
  }

  if (created > 0) console.log(`[telegram] receipt reminders created: ${created}`);
  await sendPendingNotifications();
  return created;
}

// ================= MONTHLY ANALYTICS REPORT (B) =================

/** Отправить в Telegram отчёт за прошлый месяц. Idempotent: раз в месяц. */
export async function runMonthlyAnalyticsReport() {
  if (!telegramEnabled) return "disabled";
  const bot = await getBotAsync();
  if (!bot) return "no-bot";

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const key = `${prev.getFullYear()}-${prev.getMonth()}`;

  // Защита от дублей в течение месяца — персистентная (переживает рестарты).
  const already = await prisma.notification.findFirst({
    where: { type: "MONTHLY_REPORT", content: key },
  });
  if (already) return "already";

  const text = await buildMonthlyReportText(prev.getFullYear(), prev.getMonth());

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  const chats = [...new Set(users.map((u) => u.telegramChatId!).filter(Boolean))];
  if (chats.length === 0) return "no-chats";

  for (const chatId of chats) {
    try {
      await bot.api.sendMessage(chatId, text);
    } catch (e) {
      console.error(`[telegram] monthly report to ${chatId} failed:`, e);
    }
  }
  await prisma.notification.create({
    data: { type: "MONTHLY_REPORT", title: "Ежемесячный отчёт", content: key, sentToTg: true },
  });
  return "sent";
}

export function startMonthlyReportService() {
  if (!telegramEnabled) return;
  const g = globalThis as Record<string, unknown>;
  if (g.__monthlyReportStarted) return;
  g.__monthlyReportStarted = true;
  const run = () =>
    runMonthlyAnalyticsReport().catch((e) =>
      console.error("[telegram] monthly report error:", e)
    );
  // Сразу на старте и каждый час — idempotent гасит дубли.
  run();
  g.__monthlyReportTimer = setInterval(run, 60 * 60 * 1000);
}

// ================= INTERVAL LOOPS =================

const g = globalThis as unknown as {
  __notifSenderStarted?: boolean;
  __dailyCronStarted?: boolean;
  __notifTimer?: ReturnType<typeof setInterval>;
  __cronTimer?: ReturnType<typeof setInterval>;
};

/** Start the 30s pending-notification sender and the daily cron, guarded. */
export function startNotificationServices() {
  if (!telegramEnabled) return;

  if (!g.__notifSenderStarted) {
    g.__notifSenderStarted = true;
    g.__notifTimer = setInterval(() => {
      sendPendingNotifications().catch((e) =>
        console.error("[telegram] pending sender error:", e)
      );
    }, 30_000);
  }

  if (!g.__dailyCronStarted) {
    g.__dailyCronStarted = true;
    // Immediately on boot, then every 6 hours (cheap dedup via alreadyNotifiedToday).
    runDailyExpiryAlerts().catch((e) => console.error("[telegram] daily cron error:", e));
    runReceiptReminders().catch((e) => console.error("[telegram] receipt reminders error:", e));
    g.__cronTimer = setInterval(() => {
      runDailyExpiryAlerts().catch((e) => console.error("[telegram] daily cron error:", e));
      runReceiptReminders().catch((e) => console.error("[telegram] receipt reminders error:", e));
    }, 6 * 3600 * 1000);
  }

  // Ежемесячный аналитический отчёт (пункт B) — раз в час, идемпотентен.
  startMonthlyReportService();

  // Еженедельный дайджест (понедельник ~9:00 Красноярск) — раз в час, идемпотентен.
  startWeeklyDigestService();
}