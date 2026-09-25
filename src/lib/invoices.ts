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
    const uploadDir = uploadsPath("invoices", String(existing.id));
    if (!uploadDir) throw new Error("Invalid upload path");
    await mkdir(uploadDir, { recursive: true });
    const safeName = input.receiptName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._-]/g, "_");
    await writeFile(join(uploadDir, `receipt_${safeName}`), input.receiptBytes);
    receiptFile = `/invoices/${existing.id}/receipt_${safeName}`;
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
