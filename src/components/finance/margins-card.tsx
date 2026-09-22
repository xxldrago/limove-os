"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Target } from "lucide-react";

interface MarginRow {
  id: number;
  slug: string;
  name: string;
  income: number;
  expense: number;
  margin: number;
  marginPct: number;
  profit: number;
}

interface ForecastData {
  year: number;
  goal: number;
  incomeYTD: number;
  forecast: number;
  monthsLeft: number;
  projectedMet: boolean;
  shortfall: number;
}

function useMarginsData() {
  const [margins, setMargins] = useState<MarginRow[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/margins");
      if (res.ok) {
        const j = await res.json();
        setMargins(j.margins ?? []);
        setForecast(j.forecast ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { margins, forecast };
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** Прогноз годовой цели (пункт D). */
export function ForecastCard() {
  const { forecast } = useMarginsData();

  if (!forecast || forecast.goal <= 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4" /> Прогноз на {forecast.year} год
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Заработано</span>
          <span className="num font-medium">{fmt(forecast.incomeYTD)} ₽</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Прогноз к концу года</span>
          <span className="num font-medium">{fmt(Math.round(forecast.forecast))} ₽</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Цель</span>
          <span className="num font-medium">{fmt(forecast.goal)} ₽</span>
        </div>
        {forecast.projectedMet ? (
          <Badge className="bg-[#7fb069]/15 !text-[#34D399] border-0">✅ Достигнет цели</Badge>
        ) : (
          <Badge className="bg-[#e8a552]/20 !text-[#FBBF24] border-0">
            ⚠️ Не хватает {fmt(Math.round(forecast.shortfall))} ₽
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/** Рейтинг маржинальности проектов (пункт D). */
export function MarginsRankCard() {
  const { margins } = useMarginsData();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Маржинальность проектов
        </CardTitle>
      </CardHeader>
      <CardContent>
        {margins.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">Нет данных</div>
        ) : (
          <div className="space-y-2">
            {margins.map((m, i) => (
              <a
                key={m.id}
                href={`/projects/${m.slug}`}
                className="flex items-center justify-between rounded-[10px] border border-[#1E2638] p-2.5 transition-colors hover:bg-[#131926]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="num w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="truncate text-sm font-medium">{m.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num hidden text-xs text-muted-foreground sm:inline">{m.marginPct}% маржи</span>
                  <span className={`num text-sm font-semibold ${m.margin >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
                    {fmt(m.margin)} ₽
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Совмещённый вариант (прогноз + маржинальность). */
export function MarginsCard() {
  return (
    <>
      <ForecastCard />
      <MarginsRankCard />
    </>
  );
}
