"use client";

import { useState, useEffect } from "react";
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
import { Target, Pencil } from "lucide-react";

interface GoalData {
  year: number;
  targetAmount: number | null;
  earned: number;
  remaining: number | null;
  progress: number;
  set: boolean;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function yearOptions(baseYear: number): number[] {
  // Next 5 years: current..current+5
  return Array.from({ length: 6 }, (_, i) => baseYear + i);
}

export function FinancialGoalCard() {
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [yearInput, setYearInput] = useState<number>(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  const loadGoal = async (year?: number) => {
    try {
      const url = year
        ? `/api/finance/goal?year=${year}`
        : "/api/finance/goal";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGoal(data);
        setYearInput(data.year);
        if (data.targetAmount != null) setTargetInput(String(data.targetAmount));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadGoal();
  }, []);

  // Default suggestion for the target when no goal is set for the selected year:
  // use last year's earned income if available, otherwise leave a helpful placeholder.
  const suggestTarget = async (year: number) => {
    try {
      const res = await fetch(`/api/finance/goal?year=${year - 1}`);
      if (res.ok) {
        const data = await res.json();
        if (data.earned && data.earned > 0) {
          setTargetInput(String(Math.round(data.earned)));
          return;
        }
      }
    } catch {
      // ignore
    }
    setTargetInput("");
  };

  const startEditing = () => {
    const newEditing = !editing;
    setEditing(newEditing);
    if (newEditing) {
      setYearInput(goal?.year ?? new Date().getFullYear());
      const current = goal?.targetAmount;
      if (current != null) setTargetInput(String(current));
      else suggestTarget(goal?.year ?? new Date().getFullYear());
    }
  };

  const onYearChange = (value: string) => {
    if (value == null) return;
    const y = parseInt(value);
    setYearInput(y);
    // Reset the target to a suggestion for the newly selected year.
    suggestTarget(y);
  };

  const saveGoal = async () => {
    const value = parseFloat(targetInput);
    if (Number.isNaN(value) || value <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: yearInput, targetAmount: value }),
      });
      if (res.ok) {
        setEditing(false);
        await loadGoal(yearInput);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const progress = Math.min(100, Math.round(goal?.progress ?? 0));
  const pct = goal?.progress ?? 0;

  return (
    <div className="card">
      <div className="card-head-row mb-3">
        <div className="card-title-row">
          <Target className="icon-xs" />
          <span className="card-title">Финансовая цель {goal?.year}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={startEditing} aria-label="Редактировать цель">
          <Pencil className="icon-xs" />
        </Button>
      </div>
      {goal ? (
        <>
          <div className="form-grid-2" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <div>
              <div className="stat-label">Цель</div>
              <div className="stat-value">{goal.targetAmount != null ? formatMoney(goal.targetAmount) : "—"}</div>
            </div>
            <div>
              <div className="stat-label">Заработано</div>
              <div className="stat-value stat-value--pos">{formatMoney(goal.earned)}</div>
            </div>
            <div>
              <div className="stat-label">Осталось</div>
              <div className="stat-value">{goal.remaining != null ? formatMoney(goal.remaining) : "—"}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="progress-label">
              <span>Прогресс</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="meter-track mt-3">
              <div className="meter-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {editing && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="form-row">
                <Label>Год</Label>
                <Select
                  value={String(yearInput)}
                  onValueChange={(v) => v != null && onYearChange(v)}
                  items={yearOptions(new Date().getFullYear()).map((y) => ({ value: String(y), label: String(y) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions(new Date().getFullYear()).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-row">
                <Label>Цель на год (₽)</Label>
                <Input
                  type="number"
                  min="0"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="например 1200000"
                />
                {targetInput === "" && (
                  <p className="hint">Подсказка: укажите сумму, например 1200000</p>
                )}
              </div>
              <div className="form-actions">
                <Button size="sm" onClick={saveGoal} disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="page-sub">Загрузка...</p>
      )}
    </div>
  );
}
