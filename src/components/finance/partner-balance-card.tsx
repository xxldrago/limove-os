"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BalanceData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  partners: {
    lesha: { name: string; share: number; spent: number; balance: number };
    gena: { name: string; share: number; spent: number; balance: number };
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

export function PartnerBalanceCard({ balance }: { balance: BalanceData }) {
  const { lesha, gena } = balance.partners;

  const [confirming, setConfirming] = useState(false);
  const [settling, setSettling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const settleDebts = async () => {
    setSettling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/finance/settle-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: balance.month }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Ошибка при погашении долгов");
      } else if (data.alreadyEqual) {
        setMessage("Баланс уже равен — долгов нет");
      } else {
        setMessage(data.message || "Долги погашены");
      }
      setConfirming(false);
      // Refresh balance so equalized balances appear immediately.
      window.location.reload();
    } catch {
      setMessage("Ошибка сети при погашении долгов");
      setConfirming(false);
    } finally {
      setSettling(false);
    }
  };

  let balanceStatement: string;
  let diff = lesha.balance - gena.balance;

  if (Math.abs(diff) < 0.01) {
    balanceStatement = "Баланс равен";
  } else if (diff > 0) {
    balanceStatement = `Гена должен Лёше ${formatMoney(diff)}`;
  } else {
    balanceStatement = `Лёша должен Гене ${formatMoney(Math.abs(diff))}`;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Баланс партнёров</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Леша */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Лёша</span>
            <Badge variant="outline" className="text-xs">
              Доля {formatMoney(lesha.share)}
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Потрачено</span>
              <span className="font-medium text-red-600">{formatMoney(lesha.spent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Баланс</span>
              <span className={`font-semibold ${lesha.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatMoney(lesha.balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Гена */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Гена</span>
            <Badge variant="outline" className="text-xs">
              Доля {formatMoney(gena.share)}
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Потрачено</span>
              <span className="font-medium text-red-600">{formatMoney(gena.spent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Баланс</span>
              <span className={`font-semibold ${gena.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatMoney(gena.balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Statement */}
        <div className="rounded-lg bg-muted p-3 text-center font-medium">
          {balanceStatement}
        </div>

        {/* Settle debts */}
        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setConfirming((c) => !c);
              setMessage(null);
            }}
            disabled={settling}
          >
            Долги погашены
          </Button>

          {confirming && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-center font-medium">
                Подтвердить погашение долгов?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="default"
                  className="flex-1"
                  onClick={settleDebts}
                  disabled={settling}
                >
                  {settling ? "Погашаем…" : "Да, погасить"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirming(false)}
                  disabled={settling}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`rounded-lg p-3 text-center text-xs font-medium ${
                message.startsWith("Ошибка")
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