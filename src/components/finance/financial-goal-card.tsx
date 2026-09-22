"use client";

import { useState, useEffect } from "react";
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
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-[#10B981]" />
          Финансовая цель {goal?.year}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={startEditing}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {goal ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Цель</div>
                <div className="font-bold">{goal.targetAmount != null ? formatMoney(goal.targetAmount) : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Заработано</div>
                <div className="font-semibold text-[#34D399]">{formatMoney(goal.earned)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Осталось</div>
                <div className="font-semibold text-[#34D399]">{goal.remaining != null ? formatMoney(goal.remaining) : "—"}</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="font-medium">{pct.toFixed(0)}%</span>
              </div>
              <div className="fern-track !h-2.5">
                <div
                  className="fern-fill transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {editing && (
              <div className="space-y-2 border-t pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Год</Label>
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
                <div className="space-y-1">
                  <Label className="text-xs">Цель на год (₽)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="например 1200000"
                  />
                  {targetInput === "" && (
                    <p className="text-xs text-muted-foreground">
                      Подсказка: укажите сумму, например 1200000
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
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
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        )}
      </CardContent>
    </Card>
  );
}