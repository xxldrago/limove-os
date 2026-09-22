"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface BalanceData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  settled: boolean;
  settledAmount: number;
  debt: number;
  debtor: string;
  creditor: string;
  partners: {
    lesha: { name: string; share: number; spent: number; received: number; net: number; balance: number };
    gena: { name: string; share: number; spent: number; received: number; net: number; balance: number };
  };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Дательный падеж для пары известных имён: «должен Гене», а не «должен Гена».
const DATIVE: Record<string, string> = { "Лёша": "Лёше", "Гена": "Гене" };
const dative = (name: string) => DATIVE[name] ?? name;

type Mode = "full" | "partial" | null;

export function PartnerBalanceCard({
  balance,
  onSettled,
}: {
  balance: BalanceData;
  onSettled?: () => void;
}) {
  const { lesha, gena } = balance.partners;

  const [choice, setChoice] = useState<Mode>(null);
  const [partialPerson, setPartialPerson] = useState<"lesha" | "gena">(
    balance.creditor === lesha.name ? "lesha" : "gena"
  );
  const [partialAmount, setPartialAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const debt = balance.debt;

  // Деньги всегда получает кредитор — держим выбор в актуальном состоянии.
  useEffect(() => {
    if (choice === null) {
      setPartialPerson(balance.creditor === lesha.name ? "lesha" : "gena");
    }
  }, [balance.creditor, balance.month, choice, lesha.name]);

  const submit = async (mode: "full" | "partial" | "skip") => {
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch("/api/finance/settle-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: balance.month,
          mode,
          person: mode === "partial" ? partialPerson : undefined,
          amount: mode === "partial" ? Number(partialAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setMessage(data.error || "Ошибка при погашении долгов");
        return;
      }
      if (data.skipped) {
        setChoice(null);
        setMessage("Погашение пропущено");
      } else if (data.alreadyEqual) {
        setMessage("Баланс уже равен — долгов нет");
        setChoice(null);
      } else {
        setMessage(data.message || "Долги погашены");
        setChoice(null);
        setPartialAmount("");
        onSettled?.();
      }
    } catch {
      setIsError(true);
      setMessage("Ошибка сети при погашении долгов");
    } finally {
      setBusy(false);
    }
  };

  const partialValue = Number(partialAmount) || 0;
  const projected = Math.max(0, Math.round((debt - partialValue) * 100) / 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Баланс партнёров</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {[lesha, gena].map((p) => (
          <div key={p.name} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground">Доля прибыли: {formatMoney(p.share)}</span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Получено</span>
                <span className="font-medium text-emerald-600">{formatMoney(p.received)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Потрачено</span>
                <span className="font-medium text-red-600">{formatMoney(p.spent)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Итого на руках</span>
                <span className={`font-semibold ${p.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatMoney(p.net)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Итоговый долг */}
        <div className="rounded-lg bg-muted p-3 text-center font-medium">
          {debt < 0.01
            ? "Баланс равен — долгов нет"
            : `${balance.debtor} должен ${dative(balance.creditor)} ${formatMoney(debt)}`}
        </div>

        {balance.settled && (
          <p className="text-center text-muted-foreground">
            В этом месяце погашено: {formatMoney(balance.settledAmount)}
          </p>
        )}

        {/* Гашение долгов */}
        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setChoice((c) => (c === null ? "full" : null));
              setMessage(null);
              setIsError(false);
            }}
            disabled={busy}
          >
            Долги погашены
          </Button>

          {choice !== null && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-auto whitespace-normal px-2 py-2 text-[11px] leading-tight"
                  onClick={() => submit("full")}
                  disabled={busy}
                >
                  Полностью
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={choice === "partial" ? "default" : "outline"}
                  className="h-auto whitespace-normal px-2 py-2 text-[11px] leading-tight"
                  onClick={() => setChoice("partial")}
                  disabled={busy}
                >
                  Частично
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto whitespace-normal px-2 py-2 text-[11px] leading-tight"
                  onClick={() => submit("skip")}
                  disabled={busy}
                >
                  Пропустить
                </Button>
              </div>

              {choice === "partial" && (
                <div className="space-y-2 border-t pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Кто получил деньги</Label>
                    <Select
                      value={partialPerson}
                      onValueChange={(v) => v != null && setPartialPerson(v as "lesha" | "gena")}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue>{partialPerson === "lesha" ? lesha.name : gena.name}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lesha">{lesha.name}</SelectItem>
                        <SelectItem value="gena">{gena.name}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground">
                      Долг гасит {balance.debtor}, получить должен {balance.creditor}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Сумма, которую получил</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={String(debt)}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <p className="text-center text-muted-foreground">
                    Остаток долга после погашения: <span className="font-semibold text-foreground">{formatMoney(projected)}</span>
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => submit("partial")}
                    disabled={busy || partialValue <= 0}
                  >
                    {busy ? "Погашаем…" : "Подтвердить частичное погашение"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className={`rounded-lg p-3 text-center text-xs font-medium ${
                isError
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
