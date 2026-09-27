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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Eye, EyeOff } from "lucide-react";

export interface ServerItem {
  id: number;
  name: string;
  ip: string;
  username: string;
  registrar: string | null;
  paidUntil: string | null;
  notes: string | null;
  hasPassword: boolean;
}

function toDate(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: ServerItem | null;
  onSuccess: () => void;
}

export function ServerDialog({ open, onOpenChange, server, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrar, setRegistrar] = useState("");
  const [paidUntil, setPaidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setShowPassword(false);
    setName(server?.name ?? "");
    setIp(server?.ip ?? "");
    setUsername(server?.username ?? "root");
    setRegistrar(server?.registrar ?? "");
    setPaidUntil(toDate(server?.paidUntil));
    setNotes(server?.notes ?? "");
    // Пароль подгружаем только при редактировании (расшифровка на сервере).
    if (server) {
      fetch(`/api/servers/${server.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setPassword(d.password ?? "");
        })
        .catch(() => {});
    } else {
      setPassword("");
    }
  }, [open, server]);

  const submit = async () => {
    if (!name.trim() || !ip.trim()) {
      setError("Укажите имя и IP сервера");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        ip: ip.trim(),
        username: username.trim() || "root",
        // Пустой пароль при редактировании = оставить как был.
        ...(password ? { password } : {}),
        registrar: registrar.trim(),
        paidUntil,
        notes: notes.trim(),
      };
      const res = await fetch(server ? `/api/servers/${server.id}` : "/api/servers", {
        method: server ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Ошибка сохранения");
        return;
      }
      onSuccess();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{server ? "Редактировать сервер" : "Новый сервер"}</DialogTitle>
          <DialogDescription>
            Доступы хранятся в шифрованном виде (AES-256).
          </DialogDescription>
        </DialogHeader>
        <div className="form-grid">
          <div className="form-row">
            <Label htmlFor="srv-name">Имя сервера *</Label>
            <Input id="srv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Прод / vpn-shop" />
          </div>
          <div className="form-2col">
            <div className="form-row">
              <Label htmlFor="srv-ip">IP-адрес *</Label>
              <Input id="srv-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="64.188.97.106" />
            </div>
            <div className="form-row">
              <Label htmlFor="srv-user">Пользователь</Label>
              <Input id="srv-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />
            </div>
          </div>
          <div className="form-row">
            <Label htmlFor="srv-pass">Пароль</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input
                id="srv-pass"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={server ? "Пусто = оставить как был" : "Пароль root"}
                style={{ flex: 1 }}
              />
              <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} aria-label="Показать пароль">
                {showPassword ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
              </Button>
            </div>
          </div>
          <div className="form-2col">
            <div className="form-row">
              <Label htmlFor="srv-registrar">Регистратор</Label>
              <Input id="srv-registrar" value={registrar} onChange={(e) => setRegistrar(e.target.value)} placeholder="Timeweb / AEZA…" />
            </div>
            <div className="form-row">
              <Label htmlFor="srv-paid">Оплачен до</Label>
              <Input id="srv-paid" type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <Label htmlFor="srv-notes">Примечание</Label>
            <Textarea id="srv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Что крутится, особенности…" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <Button onClick={submit} disabled={loading} className="btn-block">
            {loading && <Loader2 className="icon-xs spin" />}
            {server ? "Сохранить" : "Добавить сервер"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
