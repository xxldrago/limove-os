"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    pos <= 3 ? "text-[#34D399]" : pos <= 10 ? "text-[#34D399]" : pos <= 30 ? "text-[#FBBF24]" : "text-[#F87171]";

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4" /> Позиции по запросам</CardTitle>
        {hasWebmaster && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Обновить
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="Добавить ключевой запрос"
            className="flex-1"
          />
          <Button size="sm" variant="default" onClick={addKeyword} disabled={adding || !newKeyword.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error && <div className="text-xs text-[#F87171]">{error}</div>}
        {hasWebmaster && (
          <div className="text-xs text-muted-foreground">Позиции — средняя позиция показа из Яндекса Вебмастера (бесплатно, без парсинга выдачи).</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Загрузка…</div>
        ) : keywords.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            {hasWebmaster ? "Добавьте ключевые запросы для отслеживания позиций." : "Для отслеживания позиций подключите Яндекс Вебмастер."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {keywords.map((k) => {
              const { current, prev } = trend(k);
              let TrendIcon = Minus, trendTone = "text-muted-foreground";
              let trendText = "—";
              if (current != null && prev != null) {
                if (current < prev) { TrendIcon = TrendingUp; trendTone = "text-[#34D399]"; trendText = `▲ ${prev - current}`; }
                else if (current > prev) { TrendIcon = TrendingDown; trendTone = "text-[#F87171]"; trendText = `▼ ${current - prev}`; }
                else { trendText = "="; }
              }
              return (
                <div key={k.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{k.keyword}</span>
                    {current != null && (
                      <span className={`text-sm font-bold ${initColor(current)}`}>{current}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {current != null && (
                      <span className={`flex items-center gap-1 text-xs ${trendTone}`}>
                        <TrendIcon className="h-3 w-3" /> {trendText}
                      </span>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeKeyword(k.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}