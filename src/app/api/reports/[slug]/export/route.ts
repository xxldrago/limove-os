import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { buildReportData } from "@/lib/report-build";
import * as XLSX from "xlsx";

/** GET /api/reports/[slug]/export?year=&month= (month 0-индексный) — отчёт проекта в .xlsx */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth()), 10);

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await buildReportData(project.id, year, month);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Показатель: "Проект", Значение: data.project.name },
      { Показатель: "Период", Значение: data.period.monthName },
      { Показатель: "Доход, ₽", Значение: Math.round(data.finance.income) },
      { Показатель: "Расходы, ₽", Значение: Math.round(data.finance.expense) },
      { Показатель: "Маржа, ₽", Значение: Math.round(data.finance.margin) },
      {
        Показатель: "Визиты",
        Значение: data.metric ? data.metric.totalVisits : "Метрика не подключена",
      },
      { Показатель: "Посетители", Значение: data.metric?.totalUsers ?? "" },
      { Показатель: "Конверсии", Значение: data.metric?.totalGoals ?? "" },
    ]),
    "Сводка"
  );

  if (data.metric && data.metric.daily.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.metric.daily.map((d) => ({
          День: d.day,
          Визиты: d.visits,
          Посетители: d.users,
          Конверсии: d.goalReaches,
        }))
      ),
      "Посещаемость"
    );
  }
  if (data.webmaster && data.webmaster.topQueries.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.webmaster.topQueries),
      "Запросы"
    );
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${slug}-${year}-${month + 1}.xlsx"`,
    },
  });
}
