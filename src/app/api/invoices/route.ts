import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") {
    where.status = status;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const description = formData.get("description") as string;
  const amount = formData.get("amount") as string;
  const projectId = formData.get("projectId") as string;
  const dueDate = formData.get("dueDate") as string;
  const file = formData.get("file") as File | null;

  if (!description || !amount) {
    return NextResponse.json({ error: "Description and amount are required" }, { status: 400 });
  }

  // Generate the next INV-XXXX number.
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { id: "desc" },
    select: { id: true, invoiceNumber: true },
  });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/^INV-(\d{4})$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  // Fallback: derive from id-based ordering to avoid collisions.
  const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      description,
      amount: parseFloat(amount),
      projectId: projectId && projectId !== "none" ? parseInt(projectId) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: "PENDING",
      createdById: parseInt(session.user.id),
    },
  });

  // Save file if provided
  if (file && file.size > 0) {
    const uploadDir = join("/app/uploads/invoices", String(invoice.id));
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { invoiceFile: `/invoices/${invoice.id}/${file.name}` },
    });
  }

  // Create notification
  await prisma.notification.create({
    data: {
      title: "Новый счёт",
      content: `Новый счёт: ${description}`,
      type: "INVOICE",
      sentToTg: false,
    },
  });

  const result = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json(result, { status: 201 });
}
