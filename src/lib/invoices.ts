import { prisma } from "@/lib/prisma";
import { uploadsPath } from "@/lib/uploads";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface MarkPaidInput {
  paymentMethod?: string;
  paidById?: number;
  paidDate?: Date;
  receiptName?: string;
  receiptBytes?: Buffer;
}

export interface MarkPaidResult {
  invoice: unknown;
  justPaid: boolean;
}

export interface CreateInvoiceInput {
  description: string;
  amount: number;
  projectId?: number | null;
  dueDate?: Date | null;
  status?: string;
  paidDate?: Date | null;
  createdById: number;
}

/** Следующий номер INV-XXXX. */
async function nextInvoiceNumber(): Promise<string> {
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { id: "desc" },
    select: { id: true, invoiceNumber: true },
  });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/^INV-(\d{4})$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `INV-${String(nextNum).padStart(4, "0")}`;
}

/**
 * Создание счёта (панель и бот): номер, запись, уведомление «Новый счёт».
 * Для переноса старых оплаченных — status/paidDate без движений в финансах.
 */
export async function createInvoice(input: CreateInvoiceInput) {
  const status = ["PENDING", "PAID", "CANCELLED"].includes(input.status ?? "")
    ? input.status!
    : "PENDING";
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      description: input.description,
      amount: input.amount,
      projectId: input.projectId ?? null,
      dueDate: input.dueDate ?? null,
      status,
      paidDate:
        status === "PAID" ? (input.paidDate ?? new Date()) : null,
      createdById: input.createdById,
    },
  });

  await prisma.notification.create({
    data: {
      title: "Новый счёт",
      content: `Новый счёт: ${input.description}`,
      type: "INVOICE",
      sentToTg: false,
    },
  });

  return invoice;
}

/**
 * Общая логика оплаты счёта: статус PAID + приход на сумму счёта
 * (+ налог 6% при безнале) + уведомление. Только реальный переход
 * в PAID создаёт движения денег — повторная оплата дублей не даёт.
 * Используется API-роутом и Telegram-ботом.
 */
export async function markInvoicePaid(
  id: number,
  input: MarkPaidInput = {}
): Promise<MarkPaidResult> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new Error("Invoice not found");

  const method = input.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";
  const paidById = input.paidById ?? existing.createdById;
  const paidAt = input.paidDate ?? new Date();

  let receiptFile: string | undefined;
  if (input.receiptBytes && input.receiptBytes.length > 0 && input.receiptName) {
    receiptFile = await attachReceiptFile(existing.id, input.receiptBytes, input.receiptName);
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "PAID",
      paymentMethod: method,
      paidById,
      paidDate: paidAt,
      ...(receiptFile ? { receiptFile } : {}),
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  const invNum = existing.invoiceNumber || `INV-${String(existing.id).padStart(4, "0")}`;
  const amount = Number(existing.amount);
  const justPaid = existing.status !== "PAID";

  if (justPaid) {
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount,
        description: `Оплата счёта ${invNum}: ${existing.description}`,
        paidById,
        projectId: existing.projectId,
        category: "Обслужка",
        date: paidAt,
      },
    });

    if (method === "BANK_TRANSFER") {
      await prisma.transaction.create({
        data: {
          type: "EXPENSE",
          amount: (amount * 6) / 100,
          description: `Налог 6% от оплаты счёта ${invNum}`,
          paidById,
          projectId: existing.projectId,
          category: "Налог",
          date: new Date(),
        },
      });
    }
  }

  await prisma.notification.create({
    data: {
      title: "Чек получен",
      content: `Счёт оплачен: ${existing.description}`,
      type: "RECEIPT",
      sentToTg: false,
    },
  });

  return { invoice: updated, justPaid };
}

/**
 * Прикрепить файл чека к счёту (панель, перенос старых, Telegram-бот).
 * Возвращает относительный путь для receiptFile.
 */
export async function attachReceiptFile(
  invoiceId: number,
  bytes: Buffer,
  fileName: string
): Promise<string> {
  const uploadDir = uploadsPath("invoices", String(invoiceId));
  if (!uploadDir) throw new Error("Invalid upload path");
  await mkdir(uploadDir, { recursive: true });
  const safeName = fileName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._-]/g, "_");
  const stored = `receipt_${safeName}`;
  await writeFile(join(uploadDir, stored), bytes);
  const rel = `/invoices/${invoiceId}/${stored}`;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { receiptFile: rel },
  });
  return rel;
}
