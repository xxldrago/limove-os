import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // INCOME | EXPENSE | null
  const month = searchParams.get("month"); // YYYY-MM
  const paidById = searchParams.get("paidById"); // user id
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("category");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (type) where.type = type;
  if (paidById) where.paidById = parseInt(paidById);
  if (projectId) where.projectId = parseInt(projectId);
  if (category) where.category = category;

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      paidBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, amount, description, paidById, projectId, category, date } = body;

  if (!type || amount === undefined || amount === null || !description || !paidById || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      type,
      amount: parseFloat(amount),
      description,
      paidById: parseInt(paidById),
      projectId: projectId ? parseInt(projectId) : null,
      category,
      date: date ? new Date(date) : new Date(),
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json(transaction, { status: 201 });
}
