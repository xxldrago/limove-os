import { Bot, Context, InlineKeyboard } from "grammy";
import { prisma } from "@/lib/prisma";
import {
  computePartnerBalance,
  LESHA_ID,
  GENA_ID,
  PLACEHOLDER_EMAIL,
} from "@/lib/finance-balance";
import { markInvoicePaid, createInvoice, attachReceiptFile } from "@/lib/invoices";

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
  const servers = await prisma.server.findMany({
    where: { paidUntil: { lte: in7, gte: now } },
  });

  if (domains.length === 0 && vpns.length === 0 && servers.length === 0) {
    return "✅ Ничего не истекает в ближайшие 7 дней";
  }

  const lines: string[] = ["⏰ Истекающие (7 дней)"];
  if (domains.length > 0) {
    lines.push("", "🌐 Домены:");
    for (const d of domains) {
      const days = Math.max(0, Math.ceil((d.expiresAt.getTime() - now.getTime()) / 86400000));
      const proj = d.project?.name ? ` (${d.project.name})` : "";
      lines.push(`• ${d.name || d.value}${proj} — истекает через ${days} дн.`);
    }
  }
  if (vpns.length > 0) {
    lines.push("", "🔑 VPN:");
    for (const v of vpns) {
      const days = Math.max(0, Math.ceil((v.expiresAt!.getTime() - now.getTime()) / 86400000));
      lines.push(`• ${v.provider} / ${v.clientName} — истекает через ${days} дн.`);
    }
  }
  if (servers.length > 0) {
    lines.push("", "🖥️ Серверы:");
    for (const s of servers) {
      const days = Math.max(0, Math.ceil((s.paidUntil!.getTime() - now.getTime()) / 86400000));
      lines.push(`• ${s.name} (${s.ip}) — оплата до ${s.paidUntil!.toLocaleDateString("ru-RU")} (осталось ${days} дн.)`);
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

// ================= QUICK TRANSACTIONS =================

interface QuickTx {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
}

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/хостинг/i, "Хостинг"],
  [/vpn|впн/i, "VPN"],
  [/налог/i, "Налог"],
  [/подписк/i, "Подписка"],
  [/продвиж|реклам|seo|сео/i, "Продвижение"],
  [/обслуж/i, "Обслужка"],
];

function guessCategory(description: string): string {
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(description)) return cat;
  }
  return "Другое";
}

/**
 * Разбор быстрых операций из свободного текста.
 *   «потратил 500 такси» / «-1 200 хостинг» → EXPENSE
 *   «получил 50000 проект» / «+100000» → INCOME
 * Возвращает null, если текст не похож на операцию.
 */
export function parseQuickTransaction(text: string): QuickTx | null {
  const t = text.trim();

  let type: "INCOME" | "EXPENSE" | null = null;
  let rest = t;
  const expensePrefix = /^(потратил[аи]?|потрачено|расход|минус|-)\s*/i;
  const incomePrefix = /^(получил[аи]?|получено|приход|доход|плюс|\+)\s*/i;
  if (expensePrefix.test(t)) {
    type = "EXPENSE";
    rest = t.replace(expensePrefix, "");
  } else if (incomePrefix.test(t)) {
    type = "INCOME";
    rest = t.replace(incomePrefix, "");
  }

  // Сумма в начале: «12 500», «12,50», «12500.5» + опционально ₽/руб.
  const m = rest.match(/^([\d][\d\s]*[.,]?[\d]*)\s*(₽|руб\.?|р\.?|rub)?\s*(.*)$/i);
  if (!m) return null;
  const numRaw = m[1].replace(/\s/g, "").replace(",", ".");
  // Отсекаем мусор вида «12.5.6» или пустые.
  if (!/^\d+(\.\d+)?$/.test(numRaw)) return null;
  const amount = parseFloat(numRaw);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let description = (m[3] || "").trim();
  // Голое число без префикса и описания — не операция («500» в чате).
  if (!type && !description) return null;
  if (!type) type = "EXPENSE";
  if (!description) description = type === "INCOME" ? "Приход" : "Расход";

  return { type, amount: Math.round(amount * 100) / 100, description };
}

async function handleQuickTransaction(ctx: Context, q: QuickTx) {
  const chatId = ctx.chat?.id;
  const user = chatId
    ? await prisma.user.findFirst({ where: { telegramChatId: chatId } })
    : null;
  if (!user) {
    await ctx.reply("Не знаю, кто ты 🤷 Нажми /start, чтобы привязать чат.");
    return;
  }

  const tx = await prisma.transaction.create({
    data: {
      type: q.type,
      amount: q.amount,
      description: q.description,
      paidById: user.id,
      category: q.type === "INCOME" ? "Другое" : guessCategory(q.description),
      date: new Date(),
    },
  });

  const sign = q.type === "INCOME" ? "+" : "−";
  const kb = new InlineKeyboard().text("↩ Отменить", `deltx:${tx.id}`);
  await ctx.reply(
    `${q.type === "INCOME" ? "💰" : "💸"} ${user.name}: ${sign}${fmtMoney(q.amount)} ₽ — ${q.description}`,
    { reply_markup: kb }
  );
}

// ================= INVOICES & TASKS FROM CHAT =================

export interface QuickInvoice {
  amount: number;
  description: string;
}

/** «счёт 15000 хостинг клиенту» → создание счёта. */
export function parseQuickInvoice(text: string): QuickInvoice | null {
  const m = text
    .trim()
    .match(/^сч[её]т\s+([\d][\d\s]*[.,]?[\d]*)\s*(₽|руб\.?|р\.?)?\s*(.*)$/i);
  if (!m) return null;
  const numRaw = m[1].replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(numRaw)) return null;
  const amount = parseFloat(numRaw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    amount: Math.round(amount * 100) / 100,
    description: (m[3] || "").trim() || "Счёт из Telegram",
  };
}

/** «задача позвонить клиенту» → создание задачи. */
export function parseQuickTask(text: string): string | null {
  const m = text.trim().match(/^(задача|задачка|таск|todo|дело)\s*[:-]?\s*(.+)$/i);
  if (!m) return null;
  const title = m[2].trim();
  return title.length >= 2 ? title : null;
}

async function userByChat(chatId: number | undefined) {
  if (!chatId) return null;
  return prisma.user.findFirst({ where: { telegramChatId: chatId } });
}

/** Подобрать активный проект по вхождению названия в текст. */
async function matchProject(text: string) {
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const low = text.toLowerCase();
  return projects.find((p) => p.name && low.includes(p.name.toLowerCase())) ?? null;
}

// Отложенные действия с TTL (бот — один процесс, in-memory достаточно).
const pendingReceipts = new Map<number, { fileId: string; until: number }>();
const pendingTasks = new Map<number, { title: string; until: number }>();
const PENDING_TTL = 10 * 60 * 1000;

function takePending<K, V>(map: Map<K, { until: number } & V>, key: K): (V & { until: number }) | null {
  const v = map.get(key);
  if (!v) return null;
  map.delete(key);
  if (v.until < Date.now()) return null;
  return v as V & { until: number };
}

/** Номер счёта из подписи/цитаты: «INV-0007», «инв-12», «счёт 7», «счёт #7». */
export function extractInvoiceRef(text: string): number | null {
  const m = text.match(/(?:INV-?|инв-?|сч[её]т\s*#?)\s*(\d{1,6})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

async function findInvoiceByRef(n: number) {
  const byId = await prisma.invoice.findUnique({ where: { id: n } });
  if (byId) return byId;
  return prisma.invoice.findFirst({
    where: { invoiceNumber: `INV-${String(n).padStart(4, "0")}` },
  });
}

/** Скачать файл из Telegram и прикрепить чеком к счёту. */
async function attachReceiptFromTg(
  ctx: Context & {
    reply: (t: string) => Promise<unknown>;
    api: { getFile: (id: string) => Promise<{ file_path?: string }> };
  },
  invoiceId: number,
  fileId: string
) {
  const f = await ctx.api.getFile(fileId);
  if (!f.file_path) {
    await ctx.reply("Не смог скачать фото. Попробуй ещё раз.");
    return;
  }
  const res = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${f.file_path}`
  );
  if (!res.ok) {
    await ctx.reply("Не смог скачать фото. Попробуй ещё раз.");
    return;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const ext = (f.file_path.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) {
    await ctx.reply("Счёт не найден (возможно, удалён).");
    return;
  }
  await attachReceiptFile(invoiceId, bytes, `tg_${Date.now()}.${ext}`);
  const num = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
  await ctx.reply(`📎 Чек прикреплён к счёту ${num} (${inv.description}).`);
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
        `/invoices — неоплаченные счета (оплата в 1 тап)\n` +
        `/tasks — открытые задачи\n` +
        `/expiring — истекает за 7 дней\n` +
        `/down — упавшие сайты\n` +
        `/help — список команд\n\n` +
        `А ещё понимаю текст: «потратил 500 такси», «получил 50000 проект»`
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      `Доступные команды:\n` +
        `/status — сводка за месяц (приход/расход/прибыль)\n` +
        `/balance — баланс партнёров (кто кому должен)\n` +
        `/invoices — неоплаченные счета с кнопкой оплаты\n` +
        `/tasks — открытые задачи с кнопкой «Готово»\n` +
        `/expiring — домены, VPN и серверы (7 дней)\n` +
        `/down — сайты, которые сейчас упали\n` +
        `/help — список команд\n\n` +
        `Быстрые сообщения:\n` +
        `«счёт 15000 ...» — новый счёт, «задача ...» — новая задача,\n` +
        `фото с подписью «INV-0007» — прикрепить чек\n` +
        `Быстрые операции текстом:\n` +
        `«потратил 500 такси», «-1200 хостинг»,\n` +
        `«получил 50000 проект», «+100000»`
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

  bot.command("invoices", async (ctx) => {
    try {
      const pending = await prisma.invoice.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, invoiceNumber: true, description: true, amount: true },
      });
      if (pending.length === 0) {
        await ctx.reply("✅ Неоплаченных счетов нет");
        return;
      }
      for (const inv of pending) {
        const num = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
        const kb = new InlineKeyboard().text("✅ Оплатить", `pay:${inv.id}`);
        await ctx.reply(
          `📄 ${num}: ${inv.description}\n💰 ${fmtMoney(Number(inv.amount))} ₽`,
          { reply_markup: kb }
        );
      }
    } catch (e) {
      await safeCatch(ctx, e, "/invoices");
    }
  });

  bot.command("tasks", async (ctx) => {
    try {
      const open = await prisma.task.findMany({
        where: { status: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { project: { select: { name: true } } },
      });
      if (open.length === 0) {
        await ctx.reply("✅ Открытых задач нет");
        return;
      }
      for (const t of open) {
        const kb = new InlineKeyboard().text("✅ Готово", `taskdone:${t.id}`);
        await ctx.reply(
          `📋 ${t.title}${t.project ? ` (${t.project.name})` : ""}`,
          { reply_markup: kb }
        );
      }
    } catch (e) {
      await safeCatch(ctx, e, "/tasks");
    }
  });

  // Свободный текст: счета, задачи, быстрые траты/приходы.
  bot.on("message:text", async (ctx) => {
    try {
      const text = (ctx.message.text || "").trim();
      if (text.startsWith("/")) return; // команды обрабатываются выше

      const chatId = ctx.chat?.id;
      const user = await userByChat(chatId);
      if (!user) {
        // Не отвечаем на каждый чих незнакомца — только подсказка для команд.
        return;
      }

      // 1) «счёт 15000 ...» → создать счёт.
      const qi = parseQuickInvoice(text);
      if (qi) {
        const project = await matchProject(qi.description);
        const inv = await createInvoice({
          description: qi.description,
          amount: qi.amount,
          projectId: project?.id ?? null,
          createdById: user.id,
        });
        const num = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
        const kb = new InlineKeyboard().text("✅ Оплатить", `pay:${inv.id}`);
        await ctx.reply(
          `📄 Счёт ${num} создан: ${qi.description}\n💰 ${fmtMoney(qi.amount)} ₽${project ? `\n📁 Проект: ${project.name}` : ""}`,
          { reply_markup: kb }
        );
        return;
      }

      // 2) «задача ...» → создать задачу (проект угадываем или спрашиваем).
      const qt = parseQuickTask(text);
      if (qt) {
        const project = await matchProject(qt);
        if (project) {
          const task = await prisma.task.create({
            data: {
              title: qt,
              projectId: project.id,
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: user.id,
            },
          });
          await ctx.reply(`📋 Задача #${task.id} создана (${project.name}): ${qt}`);
        } else {
          pendingTasks.set(chatId!, { title: qt, until: Date.now() + PENDING_TTL });
          const projects = await prisma.project.findMany({
            where: { status: "ACTIVE" },
            orderBy: { name: "asc" },
            take: 8,
            select: { id: true, name: true },
          });
          if (projects.length === 0) {
            await ctx.reply("Нет активных проектов — задачу некуда прикрепить.");
            return;
          }
          const kb = new InlineKeyboard();
          for (const p of projects) kb.text(p.name.slice(0, 30), `taskproj:${p.id}`).row();
          await ctx.reply(`📋 «${qt}» — в какой проект?`, { reply_markup: kb });
        }
        return;
      }

      // 3) Быстрые траты/приходы.
      const parsed = parseQuickTransaction(text);
      if (!parsed) return; // обычный текст — молча игнорируем
      await handleQuickTransaction(ctx, parsed);
    } catch (e) {
      await safeCatch(ctx, e, "quick-tx");
    }
  });

  // Фото чеков: подпись/ответ с номером счёта («INV-0007») → прикрепить,
  // иначе — выбор счёта кнопками.
  bot.on(["message:photo", "message:document"], async (ctx) => {
    try {
      const msg = ctx.message;
      const photo = "photo" in msg ? msg.photo : undefined;
      const doc = "document" in msg ? msg.document : undefined;
      let fileId: string | null = null;
      if (photo && photo.length > 0) fileId = photo[photo.length - 1].file_id;
      else if (doc && doc.mime_type?.startsWith("image/")) fileId = doc.file_id;
      if (!fileId) return;

      const chatId = ctx.chat?.id;
      const user = await userByChat(chatId);
      if (!user || !chatId) {
        await ctx.reply("Не знаю, кто ты 🤷 Нажми /start, чтобы привязать чат.");
        return;
      }

      const caption = ("caption" in msg ? msg.caption : "") || "";
      const quoted =
        (msg.reply_to_message as { text?: string; caption?: string } | undefined)
          ?.text ||
        (msg.reply_to_message as { caption?: string } | undefined)?.caption ||
        "";
      const ref = extractInvoiceRef(`${caption}\n${quoted}`);
      if (ref != null) {
        const inv = await findInvoiceByRef(ref);
        if (!inv) {
          await ctx.reply(`Счёт №${ref} не найден. Пришли фото с подписью «INV-0007».`);
          return;
        }
        await attachReceiptFromTg(ctx, inv.id, fileId);
        return;
      }

      // Без номера — предложить последние оплаченные без чека.
      pendingReceipts.set(chatId, { fileId, until: Date.now() + PENDING_TTL });
      const needy = await prisma.invoice.findMany({
        where: { status: "PAID", OR: [{ receiptFile: null }, { receiptFile: "" }] },
        orderBy: { paidDate: "desc" },
        take: 8,
        select: { id: true, invoiceNumber: true, description: true, amount: true },
      });
      if (needy.length === 0) {
        await ctx.reply("Счетов без чеков нет. Подпиши фото номером счёта («INV-0007»).");
        return;
      }
      const kb = new InlineKeyboard();
      for (const inv of needy) {
        const num = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
        kb.text(`${num} · ${fmtMoney(Number(inv.amount))} ₽`, `receipt:${inv.id}`).row();
      }
      await ctx.reply("📎 Чек к какому счёту прикрепить?", { reply_markup: kb });
    } catch (e) {
      await safeCatch(ctx, e, "receipt-photo");
    }
  });

  // Inline-кнопки: оплата счёта и отмена быстрой операции.
  bot.callbackQuery(/^pay:(\d+)$/, async (ctx) => {
    const invoiceId = Number(ctx.match[1]);
    try {
      const chatId = ctx.chat?.id;
      const user = chatId
        ? await prisma.user.findFirst({ where: { telegramChatId: chatId } })
        : null;
      const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) {
        await ctx.answerCallbackQuery({ text: "Счёт не найден" });
        return;
      }
      if (inv.status === "PAID") {
        await ctx.answerCallbackQuery({ text: "Счёт уже оплачен" });
        return;
      }
      const { justPaid } = await markInvoicePaid(invoiceId, {
        paymentMethod: "CASH",
        paidById: user?.id,
      });
      const num = inv.invoiceNumber || `INV-${String(inv.id).padStart(4, "0")}`;
      await ctx.answerCallbackQuery({
        text: justPaid ? "Счёт оплачен ✅" : "Уже был оплачен",
      });
      await ctx.editMessageText(
        `✅ ${num}: ${inv.description}\n💰 ${fmtMoney(Number(inv.amount))} ₽ — ОПЛАЧЕН${user ? ` (${user.name})` : ""}`
      );
    } catch (e) {
      console.error("[telegram] pay callback failed:", e);
      await ctx.answerCallbackQuery({ text: "Ошибка оплаты" });
    }
  });

  bot.callbackQuery(/^deltx:(\d+)$/, async (ctx) => {
    const txId = Number(ctx.match[1]);
    try {
      const chatId = ctx.chat?.id;
      const user = chatId
        ? await prisma.user.findFirst({ where: { telegramChatId: chatId } })
        : null;
      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      if (!tx || (user && tx.paidById !== user.id)) {
        await ctx.answerCallbackQuery({ text: "Нельзя отменить" });
        return;
      }
      await prisma.transaction.delete({ where: { id: txId } });
      await ctx.answerCallbackQuery({ text: "Операция удалена" });
      await ctx.editMessageText(`🗑 Операция «${tx.description}» (${fmtMoney(Number(tx.amount))} ₽) удалена.`);
    } catch (e) {
      console.error("[telegram] deltx callback failed:", e);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
    }
  });

  // Чек фото → выбранный счёт.
  bot.callbackQuery(/^receipt:(\d+)$/, async (ctx) => {
    const invoiceId = Number(ctx.match[1]);
    try {
      const chatId = ctx.chat?.id;
      const pending = chatId != null ? takePending(pendingReceipts, chatId) : null;
      if (!pending) {
        await ctx.answerCallbackQuery({ text: "Фото устарело — пришли ещё раз" });
        return;
      }
      await attachReceiptFromTg(ctx, invoiceId, pending.fileId);
      await ctx.answerCallbackQuery({ text: "Чек прикреплён 📎" });
    } catch (e) {
      console.error("[telegram] receipt callback failed:", e);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
    }
  });

  // Задача → выбранный проект.
  bot.callbackQuery(/^taskproj:(\d+)$/, async (ctx) => {
    const projectId = Number(ctx.match[1]);
    try {
      const chatId = ctx.chat?.id;
      const user = await userByChat(chatId);
      const pending = chatId != null ? takePending(pendingTasks, chatId) : null;
      if (!pending || !user) {
        await ctx.answerCallbackQuery({ text: "Устарело — напиши задачу ещё раз" });
        return;
      }
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      });
      if (!project) {
        await ctx.answerCallbackQuery({ text: "Проект не найден" });
        return;
      }
      const task = await prisma.task.create({
        data: {
          title: pending.title,
          projectId: project.id,
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: user.id,
        },
      });
      await ctx.answerCallbackQuery({ text: "Задача создана" });
      await ctx.editMessageText(`📋 Задача #${task.id} создана (${project.name}): ${pending.title}`);
    } catch (e) {
      console.error("[telegram] taskproj callback failed:", e);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
    }
  });

  // Задача выполнена.
  bot.callbackQuery(/^taskdone:(\d+)$/, async (ctx) => {
    const taskId = Number(ctx.match[1]);
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: { select: { name: true } } },
      });
      if (!task) {
        await ctx.answerCallbackQuery({ text: "Задача не найдена" });
        return;
      }
      if (task.status === "DONE") {
        await ctx.answerCallbackQuery({ text: "Уже выполнена" });
        return;
      }
      await prisma.task.update({ where: { id: taskId }, data: { status: "DONE" } });
      await ctx.answerCallbackQuery({ text: "Готово ✅" });
      await ctx.editMessageText(
        `✅ ${task.title}${task.project ? ` (${task.project.name})` : ""}`
      );
    } catch (e) {
      console.error("[telegram] taskdone callback failed:", e);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
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
          { command: "invoices", description: "Неоплаченные счета" },
          { command: "tasks", description: "Открытые задачи" },
          { command: "expiring", description: "Истекает за 7 дней" },
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