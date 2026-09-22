"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LineChart, BarChart, StatTile } from "@/components/ui/charts";
import { KeywordsPanel } from "./keywords-panel";
import { Link2, Link2Off, Search, TrendingUp, Loader2, FileText } from "lucide-react";
import Link from "next/link";

interface AnalyticsTabProps {
  projectId: number;
  slug: string;
}

type RangeKey = "7d" | "1m" | "3m";

function rangeFor(key: RangeKey): { from: string; to: string } {
  const to = new Date();
  const days = key === "7d" ? 6 : key === "1m" ? 29 : 89;
  const from = new Date();
  from.setDate(to.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function AnalyticsTab({ projectId, slug }: AnalyticsTabProps) {
  const [range, setRange] = useState<RangeKey>("1m");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Отчёт для клиента — выбор месяца (по умолчанию текущий)
  const today = new Date();
  const [reportYear, setReportYear] = useState(today.getFullYear());
  const [reportMonth, setReportMonth] = useState(today.getMonth());
  const monthsLabel = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(reportYear, i, 1);
    return { value: i, label: d.toLocaleDateString("ru-RU", { month: "long" }) };
  });

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    const { from, to } = rangeFor(r);
    try {
      const res = await fetch(`/api/projects/${slug}/analytics?from=${from}&to=${to}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const rangeOptions: { value: RangeKey; label: string }[] = [
    { value: "7d", label: "7 дней" },
    { value: "1m", label: "Месяц" },
    { value: "3m", label: "Квартал" },
  ];

  // Диалог выбора счётчика/хоста для привязки к проекту
  const openYandexAuth = async (service: "METRIKA" | "WEBMASTER") => {
    try {
      const res = await fetch(`/api/yandex/connect?service=${service}&projectId=${projectId}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, "_blank");
      }
    } catch { /* ignore */ }
  };
  const [connectDlg, setConnectDlg] = useState<null | "METRIKA" | "WEBMASTER">(null);
  const [availableItems, setAvailableItems] = useState<{ tokenId: number; id: string; label: string }[]>([]);
  const [needOAuth, setNeedOAuth] = useState(false);
  const [picked, setPicked] = useState("");
  const [binding, setBinding] = useState(false);

  const openConnect = async (service: "METRIKA" | "WEBMASTER") => {
    setConnectDlg(service);
    setPicked("");
    try {
      const res = await fetch(`/api/yandex/list?service=${service}`);
      if (res.ok) {
        const j = await res.json();
        setAvailableItems(j.items ?? []);
        setNeedOAuth(j.needOAuth ?? j.items.length === 0);
      }
    } catch {
      setAvailableItems([]);
      setNeedOAuth(true);
    }
  };

  const doBind = async () => {
    if (!connectDlg || !picked) return;
    setBinding(true);
    const item = availableItems.find((i) => i.id === picked);
    try {
      const res = await fetch(`/api/projects/${slug}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: connectDlg, tokenId: item?.tokenId, counterId: connectDlg === "METRIKA" ? Number(picked) : undefined, hostId: connectDlg === "WEBMASTER" ? picked : undefined }),
      });
      if (res.ok) {
        setConnectDlg(null);
        load(range);
      }
    } catch {
      // ignore
    }
    setBinding(false);
  };

  const metricConnected = data?.connected?.metric;
  const wmConnected = data?.connected?.webmaster;

  const metricRows = Array.isArray(data?.metricData) ? data.metricData : null;
  const visitsSeries = metricRows?.map((d: any) => ({ label: (d.date || "").slice(5), value: d.visits }));
  const usersSeries = metricRows?.map((d: any) => ({ label: (d.date || "").slice(5), value: d.users }));
  const convSeries = metricRows?.map((d: any) => ({ label: (d.date || "").slice(5), value: d.goalReaches }));

  const totalVisits = metricRows?.reduce((a: number, r: any) => a + Number(r.visits), 0) ?? 0;
  const totalUsers = metricRows?.reduce((a: number, r: any) => a + Number(r.users), 0) ?? 0;
  const totalPageviews = metricRows?.reduce((a: number, r: any) => a + Number(r.pageviews), 0) ?? 0;
  const totalGoals = metricRows?.reduce((a: number, r: any) => a + Number(r.goalReaches), 0) ?? 0;
  const convRate = totalVisits > 0 ? ((totalGoals / totalVisits) * 100).toFixed(1) : "0.0";

  const topQueries = Array.isArray(data?.topQueries) ? data.topQueries : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Аналитика (Яндекс)</CardTitle>
          <Select
            value={range}
            onValueChange={(v) => v != null && setRange(v as RangeKey)}
            items={rangeOptions.map((r) => ({ value: r.value, label: r.label }))}
          >
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connect status row */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              {metricConnected ? (
                <Badge className="bg-green-500/15 text-green-700">
                  <Link2 className="h-3 w-3 mr-1" /> Метрика подключена
                </Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => openConnect("METRIKA")}>
                  <Link2Off className="h-3 w-3 mr-1" /> Подключить Метрику
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {wmConnected ? (
                <Badge className="bg-green-500/15 text-green-700">
                  <TrendingUp className="h-3 w-3 mr-1" /> Вебмастер подключён
                </Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => openConnect("WEBMASTER")}>
                  <Search className="h-3 w-3 mr-1" /> Подключить Вебмастер
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
            </div>
          ) : metricConnected && metricRows ? (
            <>
              {/* Metric tiles */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatTile label="Визиты" value={totalVisits.toLocaleString("ru-RU")} />
                <StatTile label="Посетители" value={totalUsers.toLocaleString("ru-RU")} />
                <StatTile label="Просмотры" value={totalPageviews.toLocaleString("ru-RU")} />
                <StatTile label="Конверсии" value={totalGoals.toLocaleString("ru-RU")} />
                <StatTile label="Конверсия" value={`${convRate}%`} tone="green" />
              </div>

              {/* Charts */}
              {visitsSeries && visitsSeries.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Посещаемость по дням</div>
                  <LineChart data={visitsSeries} color="#6366f1" />
                </div>
              )}
              {convSeries && convSeries.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Конверсии (цели)</div>
                  <BarChart data={convSeries} color="#10b981" />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {metricConnected ? "Нет данных за период. Возможно, нужно проверить подключение." : "Подключите Яндекс Метрику, чтобы видеть посещаемость и конверсии."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyword positions (пункт A) */}
      <KeywordsPanel slug={slug} />

      {/* Report for client (пункт 4) */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Отчёт для клиента
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select
            value={String(reportMonth)}
            onValueChange={(v) => v != null && setReportMonth(Number(v))}
            items={monthsLabel.map((m) => ({ value: String(m.value), label: m.label }))}
          >
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthsLabel.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            href={`/reports/${slug}?year=${reportYear}&month=${reportMonth}`}
            target="_blank"
          >
            <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700">
              <FileText className="h-4 w-4 mr-1.5" /> Сформировать отчёт
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Webmaster: top queries */}
      {wmConnected && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Популярные запросы (Webmaster)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
            ) : topQueries && topQueries.length > 0 ? (
              <div className="border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="text-left p-2 text-xs font-medium">Запрос</th>
                      <th className="p-2 text-right text-xs font-medium">Показы</th>
                      <th className="p-2 text-right text-xs font-medium">Клики</th>
                      <th className="p-2 text-right text-xs font-medium">Позиция</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topQueries.slice(0, 15).map((q: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2 font-medium">{q.query}</td>
                        <td className="p-2 text-right">{q.shows.toLocaleString("ru-RU")}</td>
                        <td className="p-2 text-right">{q.clicks.toLocaleString("ru-RU")}</td>
                        <td className="p-2 text-right">{q.position || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground">Нет данных по запросам</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connect dialog */}
      <Dialog open={!!connectDlg} onOpenChange={(o) => !o && setConnectDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подключить {connectDlg === "METRIKA" ? "Яндекс Метрику" : "Яндекс Вебмастер"}</DialogTitle>
            <DialogDescription>
              {connectDlg === "METRIKA" ? "Выберите счётчик Метрики для этого проекта." : "Выберите хост (сайт) Вебмастера для этого проекта."}
            </DialogDescription>
          </DialogHeader>
          {needOAuth ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Нужно сначала авторизоваться в Яндексе. Откроется окно — разрешите доступ, затем вернитесь сюда.
              </p>
              <Button onClick={() => openYandexAuth(connectDlg!)} className="w-full">
                Авторизоваться в Яндексе
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{connectDlg === "METRIKA" ? "Счётчик" : "Хост"}</Label>
                <Select value={picked} onValueChange={(v) => v != null && setPicked(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите из списка" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={doBind} disabled={!picked || binding} className="w-full">
                {binding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Подключить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}