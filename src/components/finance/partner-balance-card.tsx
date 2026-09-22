"use client";

import { useEffect, useState } from "react";
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
    <div className="card">
      <div className="card-title mb-3">Баланс партнёров</div>

      {[lesha, gena].map((p) => (
        <div key={p.name} className="partner-block">
          <div className="partner-head">
            <span className="partner-name">{p.name}</span>
            <span className="partner-share">Доля прибыли: {formatMoney(p.share)}</span>
          </div>
          <div className="partner-rows">
            <div className="partner-row">
              <span>Получено</span>
              <b className="text-pos">{formatMoney(p.received)}</b>
            </div>
            <div className="partner-row">
              <span>Потрачено</span>
              <b className="text-neg">{formatMoney(p.spent)}</b>
            </div>
            <div className="partner-row partner-row--total">
              <span>Итого на руках</span>
              <b className={p.net >= 0 ? "text-pos" : "text-neg"}>{formatMoney(p.net)}</b>
            </div>
          </div>
        </div>
      ))}

      <div className="debt-banner" style={{ marginTop: 12 }}>
        {debt < 0.01
          ? "Баланс равен — долгов нет"
          : `${balance.debtor} должен ${dative(balance.creditor)} ${formatMoney(debt)}`}
      </div>

      {balance.settled && (
        <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
          В этом месяце погашено: {formatMoney(balance.settledAmount)}
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <Button
          type="button"
          className="btn-block"
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
          <div className="settle-panel" style={{ marginTop: 8 }}>
            <div className="settle-grid">
              <Button type="button" size="sm" onClick={() => submit("full")} disabled={busy}>
                Полностью
              </Button>
              <Button
                type="button"
                size="sm"
                variant={choice === "partial" ? "default" : "outline"}
                onClick={() => setChoice("partial")}
                disabled={busy}
              >
                Частично
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => submit("skip")} disabled={busy}>
                Пропустить
              </Button>
            </div>

            {choice === "partial" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border-default)", paddingTop: 8 }}>
                <div className="form-row">
                  <Label>Кто получил деньги</Label>
                  <Select
                    value={partialPerson}
                    onValueChange={(v) => v != null && setPartialPerson(v as "lesha" | "gena")}
                    items={[
                      { value: "lesha", label: lesha.name },
                      { value: "gena", label: gena.name },
                    ]}
                  >
                    <SelectTrigger>
                      <SelectValue>{partialPerson === "lesha" ? lesha.name : gena.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesha">{lesha.name}</SelectItem>
                      <SelectItem value="gena">{gena.name}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="hint">
                    Долг гасит {balance.debtor}, получить должен {balance.creditor}
                  </p>
                </div>
                <div className="form-row">
                  <Label>Сумма, которую получил</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder={String(debt)}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                  />
                </div>
                <p className="hint" style={{ textAlign: "center" }}>
                  Остаток долга после погашения:{" "}
                  <b className="cell-strong">{formatMoney(projected)}</b>
                </p>
                <Button
                  type="button"
                  className="btn-block"
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
          <div className={`notice ${isError ? "notice--err" : "notice--ok"}`} style={{ marginTop: 8 }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
