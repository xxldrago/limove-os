"use client";

import { useState, useEffect, useCallback } from "react";
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
    <div className="card">
      <div className="card-title-row mb-3">
        <Target className="icon-xs" />
        <span className="card-title">Прогноз на {forecast.year} год</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        <div className="partner-row">
          <span>Заработано</span>
          <b>{fmt(forecast.incomeYTD)} ₽</b>
        </div>
        <div className="partner-row">
          <span>Прогноз к концу года</span>
          <b>{fmt(Math.round(forecast.forecast))} ₽</b>
        </div>
        <div className="partner-row">
          <span>Цель</span>
          <b>{fmt(forecast.goal)} ₽</b>
        </div>
        {forecast.projectedMet ? (
          <span className="badge badge-success">Достигнет цели</span>
        ) : (
          <span className="badge badge-neutral">
            Не хватает {fmt(Math.round(forecast.shortfall))} ₽
          </span>
        )}
      </div>
    </div>
  );
}

/** Рейтинг маржинальности проектов (пункт D). */
export function MarginsRankCard() {
  const { margins } = useMarginsData();

  return (
    <div className="card">
      <div className="card-title-row mb-3">
        <Link2 className="icon-xs" />
        <span className="card-title">Маржинальность проектов</span>
      </div>
      {margins.length === 0 ? (
        <div className="hint">Нет данных</div>
      ) : (
        <div className="rank-list">
          {margins.map((m, i) => (
            <a key={m.id} href={`/projects/${m.slug}`} className="rank-row">
              <span className="rank-left">
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{m.name}</span>
              </span>
              <span className="rank-right">
                <span className="rank-pct">{m.marginPct}% маржи</span>
                <span className={`rank-value ${m.margin >= 0 ? "text-pos" : "text-neg"}`}>
                  {fmt(m.margin)} ₽
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
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
