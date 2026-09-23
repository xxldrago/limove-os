"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FernPage } from "@/components/fern/fern-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KeyRound, ShieldCheck } from "lucide-react";

interface UserChat {
  id: number;
  name: string;
  telegramChatId: number | null;
}

interface StatusData {
  enabled: boolean;
  connected: boolean;
  hasToken: boolean;
  botUsername: string | null;
  users: UserChat[];
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-sm ${msg.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>{msg.text}</p>
  );
}

export function SettingsPageClient() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [status, setStatus] = useState<StatusData | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Свой пароль
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Пароль партнёра (админ)
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerMsg, setPartnerMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = () =>
    fetch("/api/settings/telegram")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {});

  useEffect(() => {
    loadStatus();
  }, []);

  async function saveToken() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setMsg(
        res.ok
          ? { ok: true, text: `✅ Токен сохранён. Бот: @${data.botUsername}` }
          : { ok: false, text: data.error || "Ошибка сохранения" }
      );
      setToken("");
      await loadStatus();
    } catch {
      setMsg({ ok: false, text: "Сетевая ошибка" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/telegram/test", { method: "POST" });
      const data = await res.json();
      setMsg(
        res.ok
          ? { ok: true, text: `✅ Тест отправлен в ${data.sent} чат(ов)` }
          : { ok: false, text: data.error || "Ошибка теста" }
      );
    } catch {
      setMsg({ ok: false, text: "Сетевая ошибка" });
    } finally {
      setTesting(false);
    }
  }

  async function changeOwnPassword() {
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: "Пароли не совпадают" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ ok: true, text: "✅ Пароль изменён" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwMsg({ ok: false, text: data.error || "Ошибка смены пароля" });
      }
    } catch {
      setPwMsg({ ok: false, text: "Сетевая ошибка" });
    } finally {
      setPwSaving(false);
    }
  }

  async function changePartnerPassword() {
    setPartnerMsg(null);
    if (!targetUserId) {
      setPartnerMsg({ ok: false, text: "Выберите пользователя" });
      return;
    }
    setPartnerSaving(true);
    try {
      const res = await fetch(`/api/settings/users/${targetUserId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: partnerPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPartnerMsg({ ok: true, text: `✅ ${data.message}` });
        setPartnerPassword("");
      } else {
        setPartnerMsg({ ok: false, text: data.error || "Ошибка смены пароля" });
      }
    } catch {
      setPartnerMsg({ ok: false, text: "Сетевая ошибка" });
    } finally {
      setPartnerSaving(false);
    }
  }

  const partners = (status?.users ?? []).filter((u) => !u.name.startsWith("—"));

  return (
    <div className="narrow-col">
      <FernPage
        title="Настройки"
        sub={status?.botUsername ? `Бот: @${status.botUsername}` : "Управление доступом и уведомлениями"}
      >
        {/* Смена своего пароля */}
        <div className="card">
          <div className="card-head-row mb-3">
            <span className="card-title-row">
              <KeyRound className="icon-xs" /> Сменить пароль
            </span>
          </div>
          <div className="stack-sm">
            <div className="form-row">
              <Label htmlFor="cur-pass">Текущий пароль</Label>
              <Input
                id="cur-pass"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <Label htmlFor="new-pass">Новый пароль</Label>
                <Input
                  id="new-pass"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="form-row">
                <Label htmlFor="new-pass2">Повторите новый пароль</Label>
                <Input
                  id="new-pass2"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button
                onClick={changeOwnPassword}
                disabled={pwSaving || !currentPassword || !newPassword}
                
              >
                {pwSaving ? "Сохранение..." : "Сохранить пароль"}
              </Button>
              <Msg msg={pwMsg} />
            </div>
          </div>
        </div>

        {/* Пароль партнёра — только для администратора */}
        {isAdmin && (
          <div className="card">
            <div className="card-head-row mb-3">
              <span className="card-title-row">
                <ShieldCheck className="icon-xs" /> Задать пароль партнёру
              </span>
            </div>
            <div className="stack-sm">
              <div className="form-grid-2">
                <div className="form-row">
                  <Label>Пользователь</Label>
                  <Select
                    value={targetUserId}
                    onValueChange={(v) => v != null && setTargetUserId(v)}
                    items={partners.map((u) => ({ value: String(u.id), label: u.name }))}
                  >
                    <SelectTrigger className="btn-block">
                      <SelectValue placeholder="Выберите пользователя" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-row">
                  <Label htmlFor="partner-pass">Новый пароль</Label>
                  <Input
                    id="partner-pass"
                    type="password"
                    autoComplete="new-password"
                    value={partnerPassword}
                    onChange={(e) => setPartnerPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-actions">
                <Button
                  onClick={changePartnerPassword}
                  disabled={partnerSaving || !targetUserId || !partnerPassword}
                  
                >
                  {partnerSaving ? "Сохранение..." : "Задать пароль"}
                </Button>
                <Msg msg={partnerMsg} />
              </div>
            </div>
          </div>
        )}

        {/* Telegram-бот */}
        <div className="card">
          <div className="card-head-row mb-3">
            <span className="card-title">Telegram-бот</span>
            {status && (
              <Badge variant={status.connected ? "default" : "secondary"}>
                {status.connected ? "Подключён" : "Не настроен"}
              </Badge>
            )}
          </div>
          <div className="stack">
            <div className="form-row">
              <Label htmlFor="token">Токен бота (TELEGRAM_BOT_TOKEN)</Label>
              <div className="input-row">
                <Input
                  id="token"
                  type="password"
                  placeholder={status?.hasToken ? "•••••••• (токен уже задан)" : "Введите токен..."}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button onClick={saveToken} disabled={saving || !token.trim()}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
            <div className="form-actions">
              <Button variant="outline" onClick={testConnection} disabled={testing || !status?.connected}>
                {testing ? "Отправка..." : "Проверить соединение"}
              </Button>
              <span className="page-sub">
                Отправит тестовое сообщение во все зарегистрированные чаты
              </span>
            </div>
            <Msg msg={msg} />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Партнёр</TableHead>
                  <TableHead>Chat ID</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status?.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.telegramChatId ?? "—"}</TableCell>
                    <TableCell>
                      {u.telegramChatId ? (
                        <Badge variant="default">Привязан</Badge>
                      ) : (
                        <Badge variant="secondary">Не привязан</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="hint">
              Чтобы привязать чат: напишите боту команду /start из вашего Telegram.
            </p>
          </div>
        </div>
      </FernPage>
    </div>
  );
}
