"use client";

import { useState, useCallback, useEffect } from "react";
import { FernPage } from "@/components/fern/fern-page";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { ServerDialog, type ServerItem } from "@/components/servers/server-dialog";
import { DeleteConfirmDialog } from "@/components/vpn/delete-confirm-dialog";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function PaidBadge({ paidUntil }: { paidUntil: string | null }) {
  if (!paidUntil) return <span className="hint">—</span>;
  const d = daysUntil(paidUntil);
  const date = new Date(paidUntil).toLocaleDateString("ru-RU");
  if (d == null) return <span>{date}</span>;
  if (d < 0) return <span className="cell-strong">⚫ {date} (истёк)</span>;
  if (d <= 7) return <span className="text-neg">🔴 {date} ({d} дн.)</span>;
  if (d <= 30) return <span className="expiry-warn">🟡 {date} ({d} дн.)</span>;
  return <span className="text-pos">🟢 {date}</span>;
}

export function ServersPageClient() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerItem | null>(null);
  const [deleting, setDeleting] = useState<ServerItem | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, string>>({});

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servers");
      if (res.ok) setServers(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((c) => ({ ...c, [key]: true }));
      setTimeout(() => setCopied((c) => ({ ...c, [key]: false })), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const revealPassword = async (s: ServerItem) => {
    if (revealed[s.id] !== undefined) {
      // Скрыть обратно.
      setRevealed((r) => {
        const next = { ...r };
        delete next[s.id];
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/servers/${s.id}`);
      if (res.ok) {
        const d = await res.json();
        setRevealed((r) => ({ ...r, [s.id]: d.password ?? "" }));
      }
    } catch {
      /* ignore */
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    await fetch(`/api/servers/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    fetchServers();
  };

  const expiring = servers.filter((s) => {
    const d = daysUntil(s.paidUntil);
    return d != null && d >= 0 && d <= 7;
  }).length;

  return (
    <FernPage
      title="Серверы"
      sub={expiring > 0 ? `Оплата истекает: ${expiring}` : "Доступы и оплата серверов"}
      tools={
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="btn-tall">
          <Plus className="icon-xs" /> Добавить сервер
        </Button>
      }
    >
      {loading ? (
        <div className="empty-state">Загрузка...</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">Нет серверов. Добавьте первый.</div>
      ) : (
        <div className="card card-flush">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Пароль</TableHead>
                <TableHead>Регистратор</TableHead>
                <TableHead>Оплачен до</TableHead>
                <TableHead>Примечание</TableHead>
                <TableHead aria-label="Действия" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="cell-strong">{s.name}</TableCell>
                  <TableCell>
                    <span className="mono">{s.ip}</span>{" "}
                    <Button variant="ghost" size="icon" onClick={() => copy(`ip-${s.id}`, s.ip)} aria-label="Скопировать IP">
                      {copied[`ip-${s.id}`] ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
                    </Button>
                  </TableCell>
                  <TableCell className="mono">{s.username}</TableCell>
                  <TableCell>
                    {!s.hasPassword ? (
                      <span className="hint">—</span>
                    ) : revealed[s.id] !== undefined ? (
                      <>
                        <span className="mono">{revealed[s.id] || "—"}</span>{" "}
                        <Button variant="ghost" size="icon" onClick={() => copy(`pw-${s.id}`, revealed[s.id])} aria-label="Скопировать пароль">
                          {copied[`pw-${s.id}`] ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
                        </Button>{" "}
                        <Button variant="ghost" size="icon" onClick={() => revealPassword(s)} aria-label="Скрыть пароль">
                          <EyeOff className="icon-xs" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => revealPassword(s)} aria-label="Показать пароль">
                        <Eye className="icon-xs" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{s.registrar ?? "—"}</TableCell>
                  <TableCell><PaidBadge paidUntil={s.paidUntil} /></TableCell>
                  <TableCell>{s.notes ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }} aria-label="Редактировать">
                      <Pencil className="icon-xs" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(s)} aria-label="Удалить">
                      <Trash2 className="icon-xs" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        server={editing}
        onSuccess={() => {
          setDialogOpen(false);
          fetchServers();
        }}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Удалить сервер"
        description={deleting ? `Удалить сервер «${deleting.name}» (${deleting.ip})? Доступы будут потеряны.` : ""}
        onConfirm={doDelete}
      />
    </FernPage>
  );
}
