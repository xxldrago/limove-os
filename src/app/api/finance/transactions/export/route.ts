import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import * as XLSX from "xlsx";

/** GET /api/finance/transactions/export?month=YYYY-MM — операции месяца в .xlsx */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  let year: number, mon: number;
  if (month) {
    [year, mon] = month.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    mon = now.getMonth() + 1;
  }
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);

  const txs = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    include: { paidBy: { select: { name: true } }, project: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  const rows = txs.map((t) => ({
    Дата: t.date.toLocaleDateString("ru-RU"),
    Тип:
      t.type === "INCOME" ? "Приход" : t.type === "DEBT_SETTLEMENT" ? "Расчёт" : "Расход",
    Сумма: Number(t.amount),
    Описание: t.description,
    Категория: t.category,
    Кто: t.paidBy?.name ?? "",
    Проект: t.project?.name ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Операции");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="transactions-${year}-${String(mon).padStart(2, "0")}.xlsx"`,
    },
  });
}
