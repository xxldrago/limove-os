"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FernPage } from "@/components/fern/fern-page";
import { VpnDialog } from "@/components/vpn/vpn-dialog";
import { DeleteConfirmDialog } from "@/components/vpn/delete-confirm-dialog";

interface VpnSub {
  id: number;
  provider: string;
  serverName: string | null;
  clientName: string;
  url: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  status: string;
  notes: string | null;
}

const PROVIDERS = ["Happ", "Amnezia", "Oversub", "2kabana"];

const STATUS_META: Record<string, { label: string; emoji: string; cls: string }> = {
  ACTIVE: { label: "ACTIVE", emoji: "🟢", cls: "badge-success" },
  REVOKED: { label: "REVOKED", emoji: "🔴", cls: "badge-danger" },
  EXPIRED: { label: "EXPIRED", emoji: "⚫", cls: "badge-neutral" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, emoji: "⚪", cls: "badge-neutral" };
  return (
    <span className={`badge ${m.cls}`}>
      {m.emoji} {m.label}
    </span>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Color-coded expiry: 🟢 >30d, 🟡 7-30d, 🔴 <7d, ⚫ expired, ⚪ none
function ExpiryDisplay({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="hint">—</span>;
  const now = new Date();
  const exp = new Date(expiresAt);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let emoji = "🟢", cls = "text-pos";
  if (days < 0) { emoji = "⚫"; cls = "cell-strong"; }
  else if (days < 7) { emoji = "🔴"; cls = "text-neg"; }
  else if (days < 30) { emoji = "🟡"; cls = "expiry-warn"; }
  return <span className={cls}>{emoji} {formatDate(expiresAt)}</span>;
}

export function VpnPageClient() {
  const [subs, setSubs] = useState<VpnSub[]>([]);
  const [provider, setProvider] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VpnSub | null>(null);
  const [deleting, setDeleting] = useState<VpnSub | null>(null);
  const [copied, setCopied] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (provider !== "ALL") q.set("provider", provider);
    if (status !== "ALL") q.set("status", status);
    const res = await fetch(`/api/vpn?${q.toString()}`);
    if (res.ok) setSubs(await res.json());
  }, [provider, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopy(sub: VpnSub) {
    if (!sub.url) return;
    try {
      await navigator.clipboard.writeText(sub.url);
      setCopied((c) => ({ ...c, [sub.id]: true }));
      setTimeout(() => setCopied((c) => ({ ...c, [sub.id]: false })), 1500);
    } catch (e) {
      // clipboard may be blocked; fall back
      const ta = document.createElement("textarea");
      ta.value = sub.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied((c) => ({ ...c, [sub.id]: true }));
      setTimeout(() => setCopied((c) => ({ ...c, [sub.id]: false })), 1500);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    await fetch(`/api/vpn/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  const activeCount = subs.filter((s) => s.status === "ACTIVE").length;

  return (
    <>
    <FernPage
      title="VPN Подписки"
      total={subs.length > 0 ? `${activeCount} активны` : undefined}
      tools={
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="btn-tall">
          <Plus className="icon-xs" /> Добавить
        </Button>
      }
    >

      <div className="filter-bar">
        <Select
          value={provider}
          onValueChange={(v) => v != null && setProvider(v)}
          items={[{ value: "ALL", label: "Все" }, ...PROVIDERS.map((p) => ({ value: p, label: p }))]}
        >
          <SelectTrigger className="select-md">
            <SelectValue placeholder="Провайдер" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все</SelectItem>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => v != null && setStatus(v)}
          items={[
            { value: "ALL", label: "Все" },
            { value: "ACTIVE", label: "Активен" },
            { value: "REVOKED", label: "Отозван" },
            { value: "EXPIRED", label: "Истёк" },
          ]}
        >
          <SelectTrigger className="select-md">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все</SelectItem>
            <SelectItem value="ACTIVE">Активен</SelectItem>
            <SelectItem value="REVOKED">Отозван</SelectItem>
            <SelectItem value="EXPIRED">Истёк</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card">
        <div className="list-card-head">
          <span className="card-title">Список подписок ({subs.length})</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Провайдер</TableHead>
              <TableHead>Сервер</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Ссылка/Ключ</TableHead>
              <TableHead>Подключён</TableHead>
              <TableHead>Истекает</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="number-cell">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="empty-row">
                  Нет подписок
                </TableCell>
              </TableRow>
            ) : (
              subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="cell-strong">{s.provider}</TableCell>
                  <TableCell>{s.serverName || "—"}</TableCell>
                  <TableCell>{s.clientName}</TableCell>
                  <TableCell>
                    <span className="cell-actions">
                      <span className="mono-truncate">
                        {s.url || "—"}
                      </span>
                      {s.url && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(s)}
                            aria-label="Скопировать ссылку"
                          >
                            <Copy className="icon-xs" />
                          </Button>
                          {copied[s.id] && <span className="text-pos">✓</span>}
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(s.connectedAt)}</TableCell>
                  <TableCell><ExpiryDisplay expiresAt={s.expiresAt} /></TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="number-cell">
                    <span className="cell-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditing(s); setDialogOpen(true); }}
                        aria-label="Редактировать"
                      >
                        <Pencil className="icon-xs" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(s)}
                        aria-label="Удалить"
                      >
                        <Trash2 className="icon-xs icon-danger" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </FernPage>

      <VpnDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sub={editing}
        onSuccess={() => { setDialogOpen(false); setEditing(null); load(); }}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Удалить подписку"
        description={`Удалить подписку ${deleting?.provider} (${deleting?.clientName})?`}
        onConfirm={handleDelete}
      />
    </>
  );
}
