"use client";

interface ChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  yFormat?: (n: number) => string;
}

/** Мини-линейная диаграмма на SVG (без зависимостей). */
export function LineChart({
  data,
  height = 180,
  color = "#6366f1",
  yFormat,
}: ChartProps) {
  const w = 640;
  const h = height;
  const padX = 36;
  const padTop = 16;
  const padBottom = 28;

  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Нет данных за период</div>;
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);

  const x = (i: number) => padX + (i * (w - padX * 2)) / Math.max(data.length - 1, 1);
  const y = (v: number) =>
    padTop + ((max - v) / Math.max(max - min, 1)) * (h - padTop - padBottom);

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPts = `${padX},${h - padBottom} ${linePts} ${x(data.length - 1)},${h - padBottom}`;

  // сетка (4 линии)
  const gridLines = [];
  for (let g = 0; g <= 4; g++) {
    const gv = min + ((max - min) * g) / 4;
    const gy = y(gv);
    gridLines.push(
      <g key={g}>
        <line x1={padX} y1={gy} x2={w - padX} y2={gy} stroke="currentColor" strokeOpacity={0.08} />
        <text x={padX - 6} y={gy + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
          {yFormat ? yFormat(gv) : Math.round(gv)}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      {gridLines}
      <polygon points={areaPts} fill={color} fillOpacity={0.12} />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={3} fill={color} />
          {i % Math.ceil(data.length / 8) === 0 && (
            <text x={x(i)} y={h - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Мини-столбчатая диаграмма (для конверсий/целей). */
export function BarChart({
  data,
  height = 180,
  color = "#10b981",
  yFormat,
}: ChartProps) {
  const w = 640;
  const h = height;
  const padX = 36;
  const padTop = 12;
  const padBottom = 28;

  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Нет данных за период</div>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (w - padX * 2) / data.length;
  const barW = Math.min(bw * 0.6, 28);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const gy = padTop + g * (h - padTop - padBottom);
        return (
          <line key={g} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke="currentColor" strokeOpacity={0.08} />
        );
      })}
      {data.map((d, i) => {
        const bx = padX + i * bw + (bw - barW) / 2;
        const bh = ((d.value) / max) * (h - padTop - padBottom);
        const by = h - padBottom - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={Math.max(bh, 0)} rx={4} fill={color} />
            {i % Math.ceil(data.length / 8) === 0 && (
              <text x={bx + barW / 2} y={h - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Круглый мини-прогресс / показатели конверсии. */
export function StatTile({ label, value, sub, tone = "default" }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green" ? "text-[#34D399]"
    : tone === "amber" ? "text-[#FBBF24]"
    : tone === "red" ? "text-[#F87171]"
    : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}