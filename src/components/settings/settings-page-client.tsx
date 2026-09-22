"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FernPage } from "@/components/fern/fern-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <p className={`text-sm ${msg.ok ? "text-[#1f8a5c]" : "text-[#c25e4e]"}`}>{msg.text}</p>
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
    <div className="mx-auto max-w-3xl">
      <FernPage
        title="Настройки"
        sub={status?.botUsername ? `Бот: @${status.botUsername}` : "Управление доступом и уведомлениями"}
      >
        {/* Смена своего пароля */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Сменить пароль
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="cur-pass">Текущий пароль</Label>
              <Input
                id="cur-pass"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-pass">Новый пароль</Label>
                <Input
                  id="new-pass"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
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
            <div className="flex items-center gap-3">
              <Button
                onClick={changeOwnPassword}
                disabled={pwSaving || !currentPassword || !newPassword}
                className="h-10 rounded-[12px] bg-[#16548f] px-[18px] text-white hover:bg-[#1c68ad]"
              >
                {pwSaving ? "Сохранение..." : "Сохранить пароль"}
              </Button>
              <Msg msg={pwMsg} />
            </div>
          </CardContent>
        </Card>

        {/* Пароль партнёра — только для администратора */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Задать пароль партнёру
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Пользователь</Label>
                  <Select
                    value={targetUserId}
                    onValueChange={(v) => v != null && setTargetUserId(v)}
                    items={partners.map((u) => ({ value: String(u.id), label: u.name }))}
                  >
                    <SelectTrigger className="w-full">
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
                <div className="grid gap-2">
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
              <div className="flex items-center gap-3">
                <Button
                  onClick={changePartnerPassword}
                  disabled={partnerSaving || !targetUserId || !partnerPassword}
                  className="h-10 rounded-[12px] bg-[#16548f] px-[18px] text-white hover:bg-[#1c68ad]"
                >
                  {partnerSaving ? "Сохранение..." : "Задать пароль"}
                </Button>
                <Msg msg={partnerMsg} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Telegram-бот */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Telegram-бот</CardTitle>
            {status && (
              <Badge variant={status.connected ? "default" : "secondary"}>
                {status.connected ? "Подключён" : "Не настроен"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="token">Токен бота (TELEGRAM_BOT_TOKEN)</Label>
              <div className="flex gap-2">
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={testConnection} disabled={testing || !status?.connected}>
                {testing ? "Отправка..." : "Проверить соединение"}
              </Button>
              <span className="text-sm text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
              Чтобы привязать чат: напишите боту команду /start из вашего Telegram.
            </p>
          </CardContent>
        </Card>
      </FernPage>
    </div>
  );
}
