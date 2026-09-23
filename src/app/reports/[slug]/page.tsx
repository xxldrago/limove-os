import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { buildReportData } from "@/lib/report-build";
import { ReportPrintButton } from "@/components/reports/print-button";

// Простая SVG-линия графика посещаемости (серверный рендер, без зависимостей)
function VisitsChartSvg({ rows }: { rows: { day: number; visits: number }[] }) {
  if (rows.length === 0) return <div className="empty-state">Нет данных</div>;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
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
  if (rows.length === 0) return <div className="empty-state">Нет данных</div>;
  const w = 700, h = 200, padL = 40, padR = 10, padT = 20, padB = 30;
  const max = Math.max(...rows.map((r) => r.goalReaches), 1);
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const bw = plotW / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
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
    <div className="report-page">
      <div className="report-sheet">
        {/* Шапка */}
        <div className="report-head">
          <div>
            <div className="report-eyebrow">Limove OS · Отчёт</div>
            <h1 className="report-title">{data?.project.name}</h1>
            <p className="report-period">{data?.period.monthName}</p>
          </div>
          <ReportPrintButton />
        </div>

        <div className="report-body">
          {error ? (
            <div className="text-neg">Ошибка: {error}</div>
          ) : (
            <>
              {/* Сводка Метрики */}
              {metrika?.hasMetric && (
                <section className="report-section">
                  <h2 className="report-h2">Посещаемость</h2>
                  <div className="report-tiles-4">
                    {[
                      ["Визиты", fmt(metrika.totalVisits)],
                      ["Посетители", fmt(metrika.totalUsers)],
                      ["Просмотры", fmt(metrika.totalPageviews)],
                      ["Конверсия", `${metrika.convRate.toFixed(1)}%`],
                    ].map(([label, val]) => (
                      <div key={label} className="report-tile">
                        <div className="stat-label">{label}</div>
                        <div className="stat-value stat-value--pos">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="report-chart">
                    <div className="stat-label" style={{ marginBottom: 8 }}>Посещаемость по дням</div>
                    <VisitsChartSvg rows={metrika.daily.map((d) => ({ day: d.day, visits: d.visits }))} />
                  </div>
                  {metrika.daily.some((d) => d.goalReaches > 0) && (
                    <div className="report-chart" style={{ marginTop: 16 }}>
                      <div className="stat-label" style={{ marginBottom: 8 }}>Целевые действия по дням</div>
                      <ConvBarsSvg rows={metrika.daily.map((d) => ({ day: d.day, goalReaches: d.goalReaches }))} />
                    </div>
                  )}
                </section>
              )}

              {/* Запросы Вебмастера */}
              {webmaster?.hasWebmaster && (
                <section className="report-section">
                  <h2 className="report-h2">Поисковые запросы</h2>
                  {webmaster.topQueries.length > 0 ? (
                    <div className="report-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Запрос</th>
                            <th className="number-cell">Показы</th>
                            <th className="number-cell">Переходы</th>
                            <th className="number-cell">Позиция</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webmaster.topQueries.map((q, i) => (
                            <tr key={i}>
                              <td className="cell-strong">{q.query}</td>
                              <td className="number-cell">{q.shows.toLocaleString("ru-RU")}</td>
                              <td className="number-cell">{q.clicks.toLocaleString("ru-RU")}</td>
                              <td className="number-cell">{q.position || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="hint">Нет данных по запросам за этот месяц.</div>
                  )}
                </section>
              )}

              {/* Финансы */}
              {finance && (finance.income > 0 || finance.expense > 0) && (
                <section className="report-section">
                  <h2 className="report-h2">Финансы проекта</h2>
                  <div className="report-tiles-3">
                    <div className="report-tile report-tile--pos">
                      <div className="stat-label">Доход</div>
                      <div className="stat-value stat-value--pos">{fmt(finance.income)} ₽</div>
                    </div>
                    <div className="report-tile report-tile--neg">
                      <div className="stat-label">Расход</div>
                      <div className="stat-value stat-value--neg">{fmt(finance.expense)} ₽</div>
                    </div>
                    <div className="report-tile report-tile--pos">
                      <div className="stat-label">Профит</div>
                      <div className="stat-value stat-value--pos">{fmt(finance.margin)} ₽</div>
                    </div>
                  </div>
                </section>
              )}

              {!metrika?.hasMetric && !webmaster?.hasWebmaster && (!finance || (finance.income === 0 && finance.expense === 0)) && (
                <div className="empty-state">
                  Нет данных для отчёта за этот месяц.
                  <div className="hint" style={{ marginTop: 8 }}>Подключите Метрику или Вебмастер к проекту, чтобы отчёт наполнялся.</div>
                </div>
              )}
            </>
          )}

          <div className="report-foot">
            <span>Сформировано {new Date().toLocaleString("ru-RU")}</span>
            <a href={`/projects/${data?.project.slug}`} className="link">Вернуться к проекту</a>
          </div>
        </div>
      </div>
    </div>
  );
}
