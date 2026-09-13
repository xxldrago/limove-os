/**
 * Limove OS — Миграция данных из Excel/CSV
 * ============================================
 * Читает CSV-файлы из scripts/data/ и создаёт записи в БД через Prisma.
 *
 * Поддерживаемые файлы:
 *   transactions.csv  — транзакции
 *   projects.csv      — проекты
 *   credentials.csv   — доступы/пароли (шифрует пароль AES-256-GCM)
 *   vpn.csv           — VPN-подписки
 *   elementx.csv      — пользователи ElementX
 *
 * Запуск:
 *   npm run migrate:dry   — сухой прогон (ничего не пишет, только показывает)
 *   npm run migrate:excel — реальная миграция (пропускает дубликаты)
 *
 * Интерпретатор: ts-node (CommonJS). Запускается внутри контейнера app.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// AES-256-GCM шифрование паролей (тот же алгоритм, что в src/lib/crypto.ts)
import crypto from "crypto";
function encrypt(text: string): string {
  const key = Buffer.from(process.env.MASTER_KEY || "", "hex");
  if (key.length !== 32) throw new Error("MASTER_KEY должен быть 64 hex-символа (32 байта)");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const DATA_DIR = path.join(__dirname, "data");

const now = () => new Date();
const toDate = (s: string | undefined, fallback?: Date): Date | null => {
  if (!s) return fallback ?? null;
  // Поддержка форматов: 2025-09-13 или 13.09.2025 или DD.MM.YYYY
  const m = s.trim().match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const m2 = s.trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  return null;
};
const toNum = (s: string | undefined): number => {
  const n = parseFloat((s || "").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

// Простейший CSV-парсер с поддержкой кавычек (без внешних зависимостей)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n") {
      row.push(cur); rows.push(row); row = []; cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function readCSV(file: string): Record<string, string>[] {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) {
    console.log(`⚠️  Файл ${file} не найден — пропускаю.`);
    return [];
  }
  const raw = fs.readFileSync(fp, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCSV(raw);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] || "").trim(); });
    return o;
  });
}

async function migrateProjects(rows: Record<string, string>[]) {
  if (!rows.length) return;
  console.log(`\n📁 Проекты (${rows.length})`);
  let created = 0, skipped = 0;
  for (const r of rows) {
    const slug = r.slug || r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const exists = await prisma.project.findUnique({ where: { slug } });
    if (exists) { skipped++; continue; }
    if (!DRY) {
      await prisma.project.create({
        data: { slug, name: r.name, description: r.description || null, status: r.status || "ACTIVE" },
      });
    }
    created++;
  }
  console.log(DRY ? `  [DRY] Создал бы: ${created}, пропустил дубликаты: ${skipped}` : `  Создано: ${created}, пропущено дублей: ${skipped}`);
}

async function migrateTransactions(rows: Record<string, string>[]) {
  if (!rows.length) return;
  console.log(`\n💸 Транзакции (${rows.length})`);
  // Кэш users и проектов
  const users = await prisma.user.findMany();
  const userByEmail: Record<string, number> = {};
  users.forEach((u) => { userByEmail[u.email.toLowerCase()] = u.id; });
  const projects = await prisma.project.findMany();
  const projBySlug: Record<string, number> = {};
  projects.forEach((p) => { projBySlug[p.slug.toLowerCase()] = p.id; });

  const defaultPaidBy = users[0]?.id ?? 1;
  let created = 0, skipped = 0;
  for (const r of rows) {
    const desc = r.description;
    const dup = await prisma.transaction.findFirst({ where: { description: desc, amount: toNum(r.amount) } });
    if (dup) { skipped++; continue; }
    const paidById = userByEmail[(r.paidBy || "").toLowerCase()] ?? defaultPaidBy;
    const projectId = projBySlug[(r.project || "").toLowerCase()] ?? null;
    if (!DRY) {
      await prisma.transaction.create({
        data: {
          type: (r.type || "EXPENSE").toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE",
          amount: toNum(r.amount),
          description: desc,
          paidById,
          projectId,
          category: r.category || "Другое",
          date: toDate(r.date) || now(),
        },
      });
    }
    created++;
  }
  console.log(DRY ? `  [DRY] Создал бы: ${created}, пропустил дубликаты: ${skipped}` : `  Создано: ${created}, пропущено дублей: ${skipped}`);
}

async function migrateCredentials(rows: Record<string, string>[]) {
  if (!rows.length) return;
  console.log(`\n🔑 Доступы/пароли (${rows.length})`);
  const projects = await prisma.project.findMany();
  const projBySlug: Record<string, number> = {};
  projects.forEach((p) => { projBySlug[p.slug.toLowerCase()] = p.id; });
  let created = 0, skipped = 0;
  for (const r of rows) {
    const projectId = projBySlug[(r.project || "").toLowerCase()];
    if (!projectId) { skipped++; continue; }
    const dup = await prisma.credential.findFirst({ where: { serviceName: r.serviceName, projectId } });
    if (dup) { skipped++; continue; }
    if (!DRY) {
      await prisma.credential.create({
        data: {
          projectId,
          serviceName: r.serviceName,
          login: r.login || null,
          passwordEnc: encrypt(r.password || ""),
          url: r.url || null,
          expiresAt: toDate(r.expiresAt),
          notes: r.notes || null,
        },
      });
    }
    created++;
  }
  console.log(DRY ? `  [DRY] Создал бы: ${created}, пропустил дубликаты: ${skipped}` : `  Создано: ${created}, пропущено дублей: ${skipped}`);
}

async function migrateVpn(rows: Record<string, string>[]) {
  if (!rows.length) return;
  console.log(`\n🔒 VPN-подписки (${rows.length})`);
  let created = 0, skipped = 0;
  for (const r of rows) {
    const dup = await prisma.vpnSubscription.findFirst({ where: { provider: r.provider, clientName: r.clientName } });
    if (dup) { skipped++; continue; }
    if (!DRY) {
      await prisma.vpnSubscription.create({
        data: {
          provider: r.provider,
          serverName: r.serverName || null,
          clientName: r.clientName,
          url: r.url || null,
          connectedAt: toDate(r.connectedAt),
          expiresAt: toDate(r.expiresAt),
          status: (r.status || "ACTIVE").toUpperCase(),
          notes: r.notes || null,
        },
      });
    }
    created++;
  }
  console.log(DRY ? `  [DRY] Создал бы: ${created}, пропустил дубликаты: ${skipped}` : `  Создано: ${created}, пропущено дублей: ${skipped}`);
}

async function migrateElementx(rows: Record<string, string>[]) {
  if (!rows.length) return;
  console.log(`\n👤 Пользователи ElementX (${rows.length})`);
  let created = 0, skipped = 0;
  for (const r of rows) {
    const login = r.login || r.fullName.toLowerCase().replace(/\s+/g, "");
    const dup = await prisma.elementxUser.findUnique({ where: { login } });
    if (dup) { skipped++; continue; }
    if (!DRY) {
      await prisma.elementxUser.create({
        data: {
          fullName: r.fullName,
          login,
          registerDate: toDate(r.registerDate) || now(),
          paidDate: toDate(r.paidDate),
          company: r.company || null,
          status: (r.status || "TRIAL").toUpperCase(),
          notes: r.notes || null,
        },
      });
    }
    created++;
  }
  console.log(DRY ? `  [DRY] Создал бы: ${created}, пропустил дубликаты: ${skipped}` : `  Создано: ${created}, пропущено дублей: ${skipped}`);
}

async function main() {
  console.log(`\n${DRY ? "🔎 ДРИ-ПРОГОН" : "🚀 МИГРАЦИЯ"} — данные из ${DATA_DIR}\n${"=".repeat(50)}`);

  await migrateProjects(readCSV("projects.csv"));
  await migrateTransactions(readCSV("transactions.csv"));
  await migrateCredentials(readCSV("credentials.csv"));
  await migrateVpn(readCSV("vpn.csv"));
  await migrateElementx(readCSV("elementx.csv"));

  console.log(`\n${"=".repeat(50)}\n${DRY ? "✅ Прогон завершён. Запусти `npm run migrate:excel` для реальной миграции." : "✅ Миграция завершена."}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Ошибка:", e);
  await prisma.$disconnect();
  process.exit(1);
});