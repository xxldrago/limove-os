"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

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

const PROVIDERS = ["Happ", "Amnezia", "Oversub", "2kabana", "Другое"];
const STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"];

function toDate(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sub: VpnSub | null;
  onSuccess: () => void;
}

export function VpnDialog({ open, onOpenChange, sub, onSuccess }: Props) {
  const [provider, setProvider] = useState("Happ");
  const [serverName, setServerName] = useState("");
  const [clientName, setClientName] = useState("");
  const [url, setUrl] = useState("");
  const [connectedAt, setConnectedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setProvider(sub?.provider ?? "Happ");
      setServerName(sub?.serverName ?? "");
      setClientName(sub?.clientName ?? "");
      setUrl(sub?.url ?? "");
      setConnectedAt(toDate(sub?.connectedAt));
      setExpiresAt(toDate(sub?.expiresAt));
      setStatus(sub?.status ?? "ACTIVE");
      setNotes(sub?.notes ?? "");
      setError("");
    }
  }, [open, sub]);

  async function handleSubmit() {
    if (!clientName.trim()) {
      setError("Клиент обязателен");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        provider,
        serverName: serverName.trim() || null,
        clientName: clientName.trim(),
        url: url.trim() || null,
        connectedAt: connectedAt || null,
        expiresAt: expiresAt || null,
        status,
        notes: notes.trim() || null,
      };
      const res = sub
        ? await fetch(`/api/vpn/${sub.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/vpn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || "Ошибка сохранения");
      } else {
        onSuccess();
      }
    } catch (e) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sub ? "Редактировать подписку" : "Добавить подписку"}</DialogTitle>
          <DialogDescription>
            {sub ? "Измените данные VPN-подписки" : "Новая VPN-подписка"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Провайдер</Label>
              <Select value={provider} onValueChange={(v) => v != null && setProvider(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Сервер <span className="text-muted-foreground">(опц.)</span></Label>
              <Input value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="Germany" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Клиент</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Кому подписка" />
          </div>
          <div className="space-y-1.5">
            <Label>Ссылка/Ключ <span className="text-muted-foreground">(опц.)</span></Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="vpn://... или ключ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Дата подключения</Label>
              <Input type="date" value={connectedAt} onChange={(e) => setConnectedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Истекает</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={status} onValueChange={(v) => v != null && setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Заметки <span className="text-muted-foreground">(опц.)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}