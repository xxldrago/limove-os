"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { FernPage } from "@/components/fern/fern-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Site {
  id: number;
  name: string;
  url: string;
  projectId: number | null;
  projectName: string | null;
  isActive: boolean;
  checkInterval: number;
  lastStatus: number | null;
  lastLatency: number | null;
  isError: boolean;
  downSince: string | null;
  checkedAt: string | null;
  uptime7: number | null;
  uptime30: number | null;
  hasChecks: boolean;
}

interface Stats {
  total: number;
  online: number;
  offline: number;
  avgLatency: number | null;
}

interface Project {
  id: number;
  name: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDownSince(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  const days = Math.floor(hours / 24);
  return `${days} дн ${hours % 24} ч`;
}

function intervalLabel(sec: number): string {
  const map: Record<number, string> = {
    300: "5 мин",
    900: "15 мин",
    1800: "30 мин",
    3600: "1 час",
  };
  return map[sec] ?? `${sec} с`;
}

function UptimeBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="hint">Нет данных</span>;
  const cls = pct >= 99 ? "uptime-fill--ok" : pct >= 95 ? "uptime-fill--warn" : "uptime-fill--bad";
  return (
    <span className="uptime">
      <span className="uptime-track">
        <span className={`uptime-fill ${cls}`} style={{ display: "block", width: `${pct}%` }} />
      </span>
      <span className="uptime-pct">{pct}%</span>
    </span>
  );
}

export function MonitoringDashboard() {
  const [sites, setSites] = React.useState<Site[]>([]);
  const [stats, setStats] = React.useState<Stats>({ total: 0, online: 0, offline: 0, avgLatency: null });
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [checkingId, setCheckingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Add/edit dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Site | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    url: "",
    projectId: "",
    checkInterval: "300",
    isActive: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = React.useState<Site | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [sR, sT] = await Promise.all([
        fetch("/api/monitoring/sites"),
        fetch("/api/monitoring/stats"),
      ]);
      const sitesData = sR.ok ? await sR.json() : [];
      const statsData = sT.ok ? await sT.json() : null;
      setSites(sitesData);
      if (statsData) setStats(statsData);
    } catch {
      setError("Не удалось загрузить данные мониторинга");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = React.useCallback(async () => {
    try {
      const r = await fetch("/api/projects");
      const data = await r.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    load();
    loadProjects();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, loadProjects]);

  const handleCheckNow = async (id: number) => {
    setCheckingId(id);
    try {
      await fetch(`/api/monitoring/check/${id}`, { method: "POST" });
      await load();
    } catch {
      setError("Ошибка при проверке");
    } finally {
      setCheckingId(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", url: "", projectId: "", checkInterval: "300", isActive: true });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditing(site);
    setForm({
      name: site.name,
      url: site.url,
      projectId: site.projectId ? String(site.projectId) : "",
      checkInterval: String(site.checkInterval),
      isActive: site.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const validateUrl = (u: string): string | null => {
    if (!u) return "URL обязателен";
    try {
      const parsed = new URL(u);
      if (!["http:", "https:"].includes(parsed.protocol)) return "Протокол должен быть http/https";
      if (!parsed.hostname.includes(".")) return "Некорректный домен";
      return null;
    } catch {
      return "Некорректный URL";
    }
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) return setFormError("Название обязательно");
    const urlErr = validateUrl(form.url);
    if (urlErr) return setFormError(urlErr);

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        projectId: form.projectId ? Number(form.projectId) : null,
        checkInterval: Number(form.checkInterval),
        isActive: form.isActive,
      };
      const r = editing
        ? await fetch(`/api/monitoring/sites/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/monitoring/sites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setFormError(data.error || "Ошибка сохранения");
        return;
      }
      setDialogOpen(false);
      await load();
    } catch {
      setFormError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/monitoring/sites/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch {
      setError("Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;

  return (
    <FernPage
      title="Мониторинг"
      sub={`Сайтов: ${stats.total} · online ${stats.online} · offline ${stats.offline}`}
      total={stats.avgLatency !== null ? `${stats.avgLatency} ms` : undefined}
      tools={
        <>
          <Button variant="outline" onClick={load} className="h-10 rounded-[12px] px-[18px]">
            <RefreshCw className="mr-1 h-4 w-4" /> Обновить
          </Button>
          <Button onClick={openAdd} className="h-10 rounded-[12px] px-[18px]">＋ Добавить сайт</Button>
        </>
      }
    >
      {/* Stats row */}
      <div className="grid-stats">
        <div className="card">
          <div className="stat-label">Всего сайтов</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="card">
          <div className="stat-label">Online</div>
          <div className="stat-value stat-value--pos">{stats.online}</div>
        </div>
        <div className="card">
          <div className="stat-label">Offline</div>
          <div className="stat-value stat-value--neg">{stats.offline}</div>
        </div>
        <div className="card">
          <div className="stat-label">Среднее время ответа</div>
          <div className="stat-value">
            {stats.avgLatency !== null ? `${stats.avgLatency} ms` : "Нет данных"}
          </div>
        </div>
      </div>

      {error && (
        <div className="notice notice--err">{error}</div>
      )}

      {/* Toolbar */}
      <div>
        <h2 className="section-title">Статус сайтов</h2>
      </div>

      {/* Site grid */}
      {sites.length === 0 ? (
        <div className="empty-state">
          Нет сайтов для мониторинга. Нажмите «Добавить сайт».
        </div>
      ) : (
        <div className="site-grid">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onCheckNow={handleCheckNow}
              checking={checkingId === site.id}
              onEdit={() => openEdit(site)}
              onDelete={() => setDeleteTarget(site)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать сайт" : "Добавить сайт"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Например: Главный сайт"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.ru"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Привязка к проекту</Label>
              <Select
                value={form.projectId || "__none"}
                onValueChange={(v) => setForm({ ...form, projectId: !v || v === "__none" ? "" : v })}
                items={[
                  { value: "__none", label: "Без проекта" },
                  ...projects.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Без проекта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Без проекта</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Интервал проверки</Label>
              <Select
                value={form.checkInterval}
                onValueChange={(v: string | null) => setForm({ ...form, checkInterval: v ?? "300" })}
                items={[
                  { value: "300", label: "5 минут" },
                  { value: "900", label: "15 минут" },
                  { value: "1800", label: "30 минут" },
                  { value: "3600", label: "1 час" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">5 минут</SelectItem>
                  <SelectItem value="900">15 минут</SelectItem>
                  <SelectItem value="1800">30 минут</SelectItem>
                  <SelectItem value="3600">1 час</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive">Активен</Label>
            </div>
            {formError && <p className="text-sm text-[#F87171]">{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Отмена</Button>} />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить сайт?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Сайт «{deleteTarget?.name}» ({deleteTarget?.url}) будет удалён вместе с историей проверок.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Отмена</Button>} />
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FernPage>
  );
}

function SiteCard({
  site,
  onCheckNow,
  checking,
  onEdit,
  onDelete,
}: {
  site: Site;
  onCheckNow: (id: number) => void;
  checking: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const down = site.isError;
  return (
    <div className={`card${down ? " site-card--down" : ""}${!site.isActive ? " site-card--off" : ""}`}>
      <div className="site-head-card">
        <div className="site-id">
          <span
            className={`site-dot ${
              down ? "site-dot--bad" : site.isActive ? "site-dot--ok" : "site-dot--off"
            }`}
          />
          <div>
            <div className="site-name">{site.name}</div>
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              className="site-url"
            >
              {site.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
        </div>
        <span className={`badge ${down ? "badge-danger" : site.isActive ? "badge-success" : "badge-neutral"}`}>
          {!site.isActive ? "OFF" : down ? "DOWN" : "UP"}
        </span>
      </div>
      <div className="site-rows">
        <div className="site-row">
          <span>
            Код: <b>{site.lastStatus ?? "—"}</b>
          </span>
          <span className="num">
            {site.lastLatency !== null ? `${site.lastLatency} ms` : "Нет данных"}
          </span>
        </div>
        <div className="site-row">
          <span>Последняя проверка:</span>
          <b>{fmtTime(site.checkedAt)}</b>
        </div>

        {down && site.downSince && (
          <div className="site-down-note">
            В дауне: {fmtDownSince(site.downSince)} · код {site.lastStatus ?? "нет"}
          </div>
        )}

        <div className="site-row">
          <span>Аптайм 7 дн:</span>
          <UptimeBar pct={site.uptime7} />
        </div>
        <div className="site-row">
          <span>Аптайм 30 дн:</span>
          <UptimeBar pct={site.uptime30} />
        </div>

        <div className="site-foot">
          <span className="site-foot-meta">
            {intervalLabel(site.checkInterval)}
            {site.projectName ? ` · ${site.projectName}` : ""}
          </span>
          <div className="site-foot-actions">
            <Button variant="outline" size="sm" onClick={() => onEdit()}>
              Изменить
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete()}>
              Удалить
            </Button>
            <Button size="sm" onClick={() => onCheckNow(site.id)} disabled={checking}>
              {checking ? "…" : "🔄 Проверить сейчас"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
