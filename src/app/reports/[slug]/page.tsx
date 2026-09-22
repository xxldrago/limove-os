import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { buildReportData } from "@/lib/report-build";
import { ReportPrintButton } from "@/components/reports/print-button";

// Простая SVG-линия графика посещаемости (серверный рендер, без зависимостей)
function VisitsChartSvg({ rows }: { rows: { day: number; visits: number }[] }) {
  if (rows.length === 0) return <div className="text-sm text-[#64748B] py-6 text-center">Нет данных</div>;
  const w = 700, h = 200, padL = 40, padR = 10, padT = 20, padB = 30;
  const max = Math.max(...rows.map((r) => r.visits), 1);
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const pts = rows.map((r, i) => {
    const x = padL + (i * plotW) / Math.max(rows.length - 1, 1);
    const y = padT + plotH - (r.visits / max) * plotH;
    return `${x},${y}`;
  }).join(" ");
  const area = `${padL},${padT + plotH} ${pts} ${padL + plotW},${padT + plotH}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 0.33, 0.66, 1].map((g) => (
        <line key={g} x1={padL} y1={padT + g * plotH} x2={w - padR} y2={padT + g * plotH} stroke="#e5e7eb" strokeWidth={1} />
      ))}
      <polygon points={area} fill="#6366f1" fillOpacity={0.12} />
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {rows.filter((_, i) => i % Math.ceil(rows.length / 6) === 0).map((r, i) => {
        const idx = rows.indexOf(r);
        const x = padL + (idx * plotW) / Math.max(rows.length - 1, 1);
        return <text key={i} x={x} y={padT + plotH + 18} textAnchor="middle" fontSize={10} fill="#9ca3af">{r.day}</text>;
      })}
    </svg>
  );
}

// Простая SVG-диаграмма бар (конверсии по дням)
function ConvBarsSvg({ rows }: { rows: { day: number; goalReaches: number }[] }) {
  if (rows.length === 0) return <div className="text-sm text-[#64748B] py-6 text-center">Нет данных</div>;
  const w = 700, h = 200, padL = 40, padR = 10, padT = 20, padB = 30;
  const max = Math.max(...rows.map((r) => r.goalReaches), 1);
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const bw = plotW / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {rows.map((r, i) => {
        const bx = padL + i * bw + bw * 0.25;
        const bh = (r.goalReaches / max) * plotH;
        return (
          <rect key={i} x={bx} y={padT + plotH - bh} width={bw * 0.5} height={Math.max(bh, 1)} rx={3} fill="#10b981">
            <title>{`${r.day} число: ${r.goalReaches}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { year?: string; month?: string };
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const year = parseInt(searchParams.year ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.month ?? String(new Date().getMonth()), 10);

  let data;
  let error: string | null = null;
  try {
    const project = await (await import("@/lib/prisma")).prisma.project.findUnique({
      where: { slug: params.slug }, select: { id: true },
    });
    if (!project) throw new Error("Проект не найден");
    data = await buildReportData(project.id, year, month);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const metrika = data?.metric;
  const webmaster = data?.webmaster;
  const finance = data?.finance;

  return (
    <div className="min-h-screen bg-[#090D14] p-6 print:bg-[#0D121B] print:p-0">
      <div className="fern-panel mx-auto max-w-4xl bg-[#0D121B] print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <div className="p-8 pb-6 border-b print:border-gray-200 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#10B981] font-semibold">Limove OS · Отчёт</div>
            <h1 className="text-2xl font-bold mt-1">{data?.project.name}</h1>
            <p className="text-[#64748B] mt-1 capitalize">{data?.period.monthName}</p>
          </div>
          <ReportPrintButton />
        </div>

        <div className="p-8 pt-6">
          {error ? (
            <div className="text-[#F87171]">Ошибка: {error}</div>
          ) : (
            <>
              {/* Metrika summary tiles */}
              {metrika?.hasMetric && (
                <section className="mb-8">
                  <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-3">Посещаемость</h2>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      ["Визиты", fmt(metrika.totalVisits)],
                      ["Посетители", fmt(metrika.totalUsers)],
                      ["Просмотры", fmt(metrika.totalPageviews)],
                      ["Конверсия", `${metrika.convRate.toFixed(1)}%`],
                    ].map(([label, val]) => (
                      <div key={label} className="rounded-xl border p-4 bg-[#131926] print:bg-[#131926]">
                        <div className="text-xs text-[#64748B]">{label}</div>
                        <div className="text-2xl font-bold text-[#34D399]">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-indigo-100 p-4">
                    <div className="text-xs text-[#64748B] mb-2">Посещаемость по дням</div>
                    <VisitsChartSvg rows={metrika.daily.map((d) => ({ day: d.day, visits: d.visits }))} />
                  </div>
                  {metrika.daily.some((d) => d.goalReaches > 0) && (
                    <div className="mt-4 rounded-xl border border-green-100 p-4">
                      <div className="text-xs text-[#64748B] mb-2">Целевые действия по дням</div>
                      <ConvBarsSvg rows={metrika.daily.map((d) => ({ day: d.day, goalReaches: d.goalReaches }))} />
                    </div>
                  )}
                </section>
              )}

              {/* Webmaster top queries */}
              {webmaster?.hasWebmaster && (
                <section className="mb-8">
                  <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-3">Поисковые запросы</h2>
                  {webmaster.topQueries.length > 0 ? (
                    <div className="rounded-xl border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#131926] border-b">
                          <tr>
                            <th className="text-left p-3 text-[#64748B] font-medium">Запрос</th>
                            <th className="p-3 text-right text-[#64748B] font-medium">Показы</th>
                            <th className="p-3 text-right text-[#64748B] font-medium">Переходы</th>
                            <th className="p-3 text-right text-[#64748B] font-medium">Позиция</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webmaster.topQueries.map((q, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-3 font-medium">{q.query}</td>
                              <td className="p-3 text-right">{q.shows.toLocaleString("ru-RU")}</td>
                              <td className="p-3 text-right">{q.clicks.toLocaleString("ru-RU")}</td>
                              <td className="p-3 text-right">{q.position || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-[#64748B]">Нет данных по запросам за этот месяц.</div>
                  )}
                </section>
              )}

              {/* Finance block */}
              {finance && (finance.income > 0 || finance.expense > 0) && (
                <section className="mb-8">
                  <h2 className="text-sm font-semibold text-[#64748B] uppercase mb-3">Финансы проекта</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border p-4 bg-[rgba(52,211,153,0.1)] print:bg-[rgba(52,211,153,0.1)]">
                      <div className="text-xs text-[#64748B]">Доход</div>
                      <div className="text-xl font-bold text-[#34D399]">{fmt(finance.income)} ₽</div>
                    </div>
                    <div className="rounded-xl border p-4 bg-[rgba(248,113,113,0.1)] print:bg-[rgba(248,113,113,0.1)]">
                      <div className="text-xs text-[#64748B]">Расход</div>
                      <div className="text-xl font-bold text-[#F87171]">{fmt(finance.expense)} ₽</div>
                    </div>
                    <div className="rounded-xl border p-4 bg-[rgba(52,211,153,0.1)] print:bg-[rgba(52,211,153,0.1)]">
                      <div className="text-xs text-[#64748B]">Профит</div>
                      <div className="text-xl font-bold text-[#34D399]">{fmt(finance.margin)} ₽</div>
                    </div>
                  </div>
                </section>
              )}

              {!metrika?.hasMetric && !webmaster?.hasWebmaster && (!finance || (finance.income === 0 && finance.expense === 0)) && (
                <div className="text-center py-16 text-[#64748B]">
                  Нет данных для отчёта за этот месяц.
                  <div className="text-sm mt-2">Подключите Метрику или Вебмастер к проекту, чтобы отчёт наполнялся.</div>
                </div>
              )}
            </>
          )}

          <div className="mt-10 pt-4 border-t text-xs text-[#64748B] flex justify-between">
            <span>Сформировано {new Date().toLocaleString("ru-RU")}</span>
            <a href={`/projects/${data?.project.slug}`} className="text-indigo-500 hover:underline">Вернуться к проекту</a>
          </div>
        </div>
      </div>
    </div>
  );
}