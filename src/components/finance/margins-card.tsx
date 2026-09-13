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

/** Рейтинг маржинальности проектов + прогноз годовой цели (пункт D). */
export function MarginsCard() {
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

  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <>
      {/* Прогноз годовой цели */}
      {forecast && forecast.goal > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Прогноз на {forecast.year} год</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Заработано</span>
              <span className="font-medium">{fmt(forecast.incomeYTD)} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Прогноз к концу года</span>
              <span className="font-medium">{fmt(Math.round(forecast.forecast))} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Цель</span>
              <span className="font-medium">{fmt(forecast.goal)} ₽</span>
            </div>
            {forecast.projectedMet ? (
              <Badge className="bg-green-500/15 text-green-700">✅ Достигнет цели</Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700">
                ⚠️ Не хватает {fmt(Math.round(forecast.shortfall))} ₽
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Рейтинг маржинальности */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Маржинальность проектов</CardTitle>
        </CardHeader>
        <CardContent>
          {margins.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Нет данных</div>
          ) : (
            <div className="space-y-2">
              {margins.map((m, i) => (
                <a key={m.id} href={`/projects/${m.slug}`} className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                    <span className="font-medium text-sm truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">{m.marginPct}% маржи</span>
                    <span className={`text-sm font-semibold ${m.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(m.margin)} ₽
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}