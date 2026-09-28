"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LineChart, BarChart, StatTile } from "@/components/ui/charts";
import { KeywordsPanel } from "./keywords-panel";
import { Link2, Link2Off, Search, TrendingUp, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const [authError, setAuthError] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Диалог выбора счётчика/хоста для привязки к проекту
  const openYandexAuth = async (service: "METRIKA" | "WEBMASTER") => {
    setAuthError("");
    try {
      const res = await fetch(`/api/yandex/connect?service=${service}&projectId=${projectId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        setAuthError(data.error || "Не удалось получить ссылку авторизации");
      }
    } catch {
      setAuthError("Ошибка сети при запросе авторизации");
    }
  };
  const [connectDlg, setConnectDlg] = useState<null | "METRIKA" | "WEBMASTER">(null);
  const [availableItems, setAvailableItems] = useState<{ tokenId: number; id: string; label: string }[]>([]);
  const [needOAuth, setNeedOAuth] = useState(false);
  const [picked, setPicked] = useState("");
  const [binding, setBinding] = useState(false);

  const openConnect = async (service: "METRIKA" | "WEBMASTER") => {
    setAuthError("");
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
    setAuthError("");
    const item = availableItems.find((i) => i.id === picked);
    try {
      const res = await fetch(`/api/projects/${slug}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: connectDlg, tokenId: item?.tokenId, counterId: connectDlg === "METRIKA" ? Number(picked) : undefined, hostId: connectDlg === "WEBMASTER" ? picked : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConnectDlg(null);
        load(range);
      } else {
        setAuthError(data.error || "Не удалось подключить");
      }
    } catch {
      setAuthError("Ошибка сети при подключении");
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
    <div className="tab-inner">
      <div className="card">
        <div className="card-head-row mb-3">
          <span className="card-title">Аналитика (Яндекс)</span>
          <Select
            value={range}
            onValueChange={(v) => v != null && setRange(v as RangeKey)}
            items={rangeOptions.map((r) => ({ value: r.value, label: r.label }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            {metricConnected ? (
              <span className="badge badge-success">
                <Link2 className="icon-xs" /> Метрика подключена
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openConnect("METRIKA")}>
                <Link2Off className="icon-xs" /> Подключить Метрику
              </Button>
            )}
          </div>
          <div className="filter-group">
            {wmConnected ? (
              <span className="badge badge-success">
                <TrendingUp className="icon-xs" /> Вебмастер подключён
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openConnect("WEBMASTER")}>
                <Search className="icon-xs" /> Подключить Вебмастер
              </Button>
            )}
          </div>
        </div>

        <div className="rule" />

        {loading ? (
          <div className="empty-state">
            <Loader2 className="icon-xs" style={{ display: "inline", marginRight: 8 }} /> Загрузка…
          </div>
        ) : metricConnected && metricRows ? (
          <div className="tab-inner">
            <div className="grid-stats">
              <StatTile label="Визиты" value={totalVisits.toLocaleString("ru-RU")} />
              <StatTile label="Посетители" value={totalUsers.toLocaleString("ru-RU")} />
              <StatTile label="Просмотры" value={totalPageviews.toLocaleString("ru-RU")} />
              <StatTile label="Конверсии" value={totalGoals.toLocaleString("ru-RU")} />
              <StatTile label="Конверсия" value={`${convRate}%`} tone="green" />
            </div>

            {visitsSeries && visitsSeries.length > 0 && (
              <div>
                <div className="chart-label">Посещаемость по дням</div>
                <LineChart data={visitsSeries} color="#34D399" />
              </div>
            )}
            {convSeries && convSeries.length > 0 && (
              <div>
                <div className="chart-label">Конверсии (цели)</div>
                <BarChart data={convSeries} color="#10B981" />
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            {metricConnected
              ? "Нет данных за период. Возможно, нужно проверить подключение."
              : "Подключите Яндекс Метрику, чтобы видеть посещаемость и конверсии."}
          </div>
        )}
      </div>

      {/* Позиции по ключевым запросам */}
      <KeywordsPanel slug={slug} />

      {/* Отчёт для клиента */}
      <div className="card">
        <div className="card-title-row mb-3">
          <FileText className="icon-xs" />
          <span className="card-title">Отчёт для клиента</span>
        </div>
        <div className="filter-bar">
          <Select
            value={String(reportMonth)}
            onValueChange={(v) => v != null && setReportMonth(Number(v))}
            items={monthsLabel.map((m) => ({ value: String(m.value), label: m.label }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthsLabel.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href={`/reports/${slug}?year=${reportYear}&month=${reportMonth}`} target="_blank">
            <Button size="sm">
              <FileText className="icon-xs" /> Сформировать отчёт
            </Button>
          </Link>
        </div>
      </div>

      {/* Вебмастер: запросы */}
      {wmConnected && (
        <div className="card">
          <div className="card-title mb-3">Популярные запросы (Webmaster)</div>
          {loading ? (
            <div className="empty-state">
              <Loader2 className="icon-xs" style={{ display: "inline" }} />
            </div>
          ) : topQueries && topQueries.length > 0 ? (
            <div className="card card-flush" style={{ background: "transparent", border: 0, boxShadow: "none", padding: 0 }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Запрос</TableHead>
                    <TableHead className="number-cell">Показы</TableHead>
                    <TableHead className="number-cell">Клики</TableHead>
                    <TableHead className="number-cell">Позиция</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topQueries.slice(0, 20).map((q: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="cell-strong">{q.query}</TableCell>
                      <TableCell className="number-cell">{q.shows.toLocaleString("ru-RU")}</TableCell>
                      <TableCell className="number-cell">{q.clicks.toLocaleString("ru-RU")}</TableCell>
                      <TableCell className="number-cell">{q.position || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="empty-state">Нет данных по запросам</div>
          )}
        </div>
      )}

      {/* Диалог подключения */}
      <Dialog open={!!connectDlg} onOpenChange={(o) => !o && setConnectDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подключить {connectDlg === "METRIKA" ? "Яндекс Метрику" : "Яндекс Вебмастер"}</DialogTitle>
            <DialogDescription>
              {connectDlg === "METRIKA" ? "Выберите счётчик Метрики для этого проекта." : "Выберите хост (сайт) Вебмастера для этого проекта."}
            </DialogDescription>
          </DialogHeader>
          {needOAuth ? (
            <div className="stack-sm">
              <p className="page-sub">
                Нужно сначала авторизоваться в Яндексе. Откроется страница с кодом — разрешите доступ, скопируйте код и вставьте ниже.
              </p>
              <Button onClick={() => openYandexAuth(connectDlg!)} className="btn-block">
                Получить код в Яндексе
              </Button>
              <div className="form-row">
                <Label>Код с страницы Яндекса</Label>
                <Input
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Вставьте код…"
                />
              </div>
              <Button
                onClick={async () => {
                  if (!connectDlg || !authCode.trim()) return;
                  setConfirming(true);
                  setAuthError("");
                  try {
                    const res = await fetch("/api/yandex/token", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: authCode.trim(), service: connectDlg }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setAuthCode("");
                      await openConnect(connectDlg);
                    } else {
                      setAuthError(data.error || "Не удалось подтвердить код");
                    }
                  } catch {
                    setAuthError("Ошибка сети при подтверждении кода");
                  } finally {
                    setConfirming(false);
                  }
                }}
                disabled={!authCode.trim() || confirming}
                className="btn-block"
              >
                {confirming && <Loader2 className="icon-xs" style={{ marginRight: 8 }} />}
                Подтвердить код
              </Button>
              {authError && <p className="form-error">{authError}</p>}
            </div>
          ) : (
            <div className="stack-sm">
              <div className="form-row">
                <Label>{connectDlg === "METRIKA" ? "Счётчик" : "Хост"}</Label>
                <Select value={picked} onValueChange={(v) => v != null && setPicked(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите из списка" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={doBind} disabled={!picked || binding} className="btn-block">
                {binding && <Loader2 className="icon-xs" style={{ marginRight: 8 }} />}
                Подключить
              </Button>
              {authError && <p className="form-error">{authError}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
