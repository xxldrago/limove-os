"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KeywordRow {
  id: number;
  keyword: string;
  positions: { date: string; position: number | null }[];
}

/** Мониторинг позиций по ключевым запросам (пункт A). */
export function KeywordsPanel({ slug }: { slug: string }) {
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasWebmaster, setHasWebmaster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/keywords`);
      if (res.ok) {
        const j = await res.json();
        setKeywords(j.keywords ?? []);
        setHasWebmaster(j.hasWebmaster ?? false);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const addKeyword = async () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw }),
      });
      if (res.ok) {
        setNewKeyword("");
        load();
      } else {
        const j = await res.json();
        setError(j.error ?? "Ошибка добавления");
      }
    } catch { setError("Ошибка сети"); }
    setAdding(false);
  };

  const removeKeyword = async (id: number) => {
    await fetch(`/api/projects/${slug}/keywords`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${slug}/keywords?refresh=1`);
      if (res.ok) {
        const j = await res.json();
        setKeywords(j.keywords ?? []);
        setHasWebmaster(j.hasWebmaster ?? false);
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  // Последняя и предыдущая позиция для тренда
  const trend = (k: KeywordRow): { current: number | null; prev: number | null } => {
    const ps = k.positions.filter((p) => p.position != null).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (ps.length === 0) return { current: null, prev: null };
    const current = ps[ps.length - 1].position!;
    const prev = ps.length > 1 ? ps[ps.length - 2].position! : null;
    return { current, prev };
  };

  const initColor = (pos: number) =>
    pos <= 10 ? "text-pos" : pos <= 30 ? "expiry-warn" : "text-neg";

  return (
    <div className="card">
      <div className="card-head-row mb-3">
        <div className="card-title-row">
          <Search className="icon-xs" />
          <span className="card-title">Позиции по запросам</span>
        </div>
        {hasWebmaster && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="icon-xs" /> : <RefreshCw className="icon-xs" />}
            Обновить
          </Button>
        )}
      </div>
      <div className="stack-sm">
        <div className="form-actions" style={{ flexWrap: "nowrap" }}>
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="Добавить ключевой запрос"
          />
          <Button size="sm" onClick={addKeyword} disabled={adding || !newKeyword.trim()}>
            <Plus className="icon-xs" />
          </Button>
        </div>
        {error && <div className="hint text-neg">{error}</div>}
        {hasWebmaster && (
          <div className="hint">
            Позиции — средняя позиция показа из Яндекса Вебмастера (бесплатно, без парсинга выдачи).
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <Loader2 className="icon-xs" style={{ display: "inline", marginRight: 8 }} /> Загрузка…
          </div>
        ) : keywords.length === 0 ? (
          <div className="empty-state">
            {hasWebmaster
              ? "Добавьте ключевые запросы для отслеживания позиций."
              : "Для отслеживания позиций подключите Яндекс Вебмастер."}
          </div>
        ) : (
          <div className="stack-sm">
            {keywords.map((k) => {
              const { current, prev } = trend(k);
              let TrendIcon = Minus, trendTone = "hint";
              let trendText = "—";
              if (current != null && prev != null) {
                if (current < prev) { TrendIcon = TrendingUp; trendTone = "text-pos"; trendText = `▲ ${prev - current}`; }
                else if (current > prev) { TrendIcon = TrendingDown; trendTone = "text-neg"; trendText = `▼ ${current - prev}`; }
                else { trendText = "="; }
              }
              return (
                <div key={k.id} className="list-row">
                  <div className="rank-left">
                    <span className="cell-strong">{k.keyword}</span>
                    {current != null && (
                      <span className={`rank-value ${initColor(current)}`}>{current}</span>
                    )}
                  </div>
                  <div className="cell-actions">
                    {current != null && (
                      <span className={`rank-pct ${trendTone}`}>
                        <TrendIcon className="icon-xs" /> {trendText}
                      </span>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removeKeyword(k.id)} aria-label="Удалить запрос">
                      <Trash2 className="icon-xs" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
