import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { uploadsPath } from "@/lib/uploads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({ where: { id: parseInt(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const paymentMethod = (formData.get("paymentMethod") as string) || "CASH";
  const paidByIdRaw = formData.get("paidById") as string;
  const paidById = paidByIdRaw ? parseInt(paidByIdRaw) : existing.createdById;
  const file = formData.get("receipt") as File | null;
  const paidDate = formData.get("paidDate") as string;

  // Normalize payment method.
  const method = paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";

  let receiptFile: string | undefined;
  if (file && file.size > 0) {
    // Save receipt file
    const uploadDir = uploadsPath("invoices", String(existing.id));
    if (!uploadDir) throw new Error("Invalid upload path");
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, `receipt_${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
    receiptFile = `/invoices/${existing.id}/receipt_${file.name}`;
  }

  const updated = await prisma.invoice.update({
    where: { id: parseInt(id) },
    data: {
      status: "PAID",
      paymentMethod: method,
      paidById,
      paidDate: paidDate ? new Date(paidDate) : new Date(),
      ...(receiptFile ? { receiptFile } : {}),
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  const invNum = existing.invoiceNumber || `INV-${String(existing.id).padStart(4, "0")}`;
  const amount = Number(existing.amount);
  // Only on the actual transition to PAID, so re-saving a paid invoice
  // doesn't duplicate the money movements.
  const justPaid = existing.status !== "PAID";

  if (justPaid) {
    // 1) Доход на сумму счёта — деньги пришли, кто их получил (paidById).
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount,
        description: `Оплата счёта ${invNum}: ${existing.description}`,
        paidById,
        projectId: existing.projectId,
        category: "Обслужка",
        date: paidDate ? new Date(paidDate) : new Date(),
      },
    });

    // 2) При оплате по безналу — расход-налог 6% от суммы счёта.
    if (method === "BANK_TRANSFER") {
      const taxAmount = (amount * 6) / 100;
      await prisma.transaction.create({
        data: {
          type: "EXPENSE",
          amount: taxAmount,
          description: `Налог 6% от оплаты счёта ${invNum}`,
          paidById,
          projectId: existing.projectId,
          category: "Налог",
          date: new Date(),
        },
      });
    }
  }

  // Create notification
  await prisma.notification.create({
    data: {
      title: "Чек получен",
      content: `Счёт оплачен: ${existing.description}`,
      type: "RECEIPT",
      sentToTg: false,
    },
  });

  return NextResponse.json(updated);
}