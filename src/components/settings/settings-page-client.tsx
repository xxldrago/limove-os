"use client";

import { useEffect, useState } from "react";
import { FernPage } from "@/components/fern/fern-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export function SettingsPageClient() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings/telegram")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      const sRes = await fetch("/api/settings/telegram");
      if (sRes.ok) setStatus(await sRes.json());
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

  return (
    <div className="mx-auto max-w-3xl">
    <FernPage
      title="Настройки"
      sub={status?.botUsername ? `Бот: @${status.botUsername}` : "Укажите токен бота (через @BotFather), чтобы включить уведомления и команды"}
      tools={
        status && (
          <Badge variant={status.connected ? "default" : "secondary"}>
            {status.connected ? "Подключён" : "Не настроен"}
          </Badge>
        )
      }
    >
      <h2 className="m-0 flex items-center gap-2 text-[16.5px] font-bold tracking-[-0.02em] text-[#0f1720]">
        Telegram-бот
      </h2>
      <div className="space-y-4">
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
          {msg && (
            <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
          )}

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
      </div>
    </FernPage>
    </div>
  );
}