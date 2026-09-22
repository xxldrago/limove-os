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
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Project {
  id: number;
  name: string;
  slug: string;
}

interface Prefill {
  type?: "INCOME" | "EXPENSE";
  amount?: string;
  description?: string;
  category?: string;
}

const categories = [
  "Обслужка",
  "Налог",
  "Хостинг",
  "Подписка",
  "VPN",
  "Продвижение",
  "Другое",
];

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: "INCOME" | "EXPENSE";
  projects: Project[];
  prefill?: Prefill | null;
  onSuccess: () => void;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  initialType,
  projects,
  prefill,
  onSuccess,
}: AddTransactionDialogProps) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initialType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidById, setPaidById] = useState<string>("1");
  const [projectId, setProjectId] = useState<string>("none");
  const [category, setCategory] = useState<string>("Другое");
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setType(prefill?.type ?? initialType);
      setAmount(prefill?.amount ?? "");
      setDescription(prefill?.description ?? "");
      setCategory(prefill?.category ?? "Другое");
      setPaidById("1");
      setProjectId("none");
      setDate(new Date().toISOString().slice(0, 10));
      setError("");
    }
  }, [open, prefill, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) {
      setError("Заполните сумму и описание");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          description,
          paidById: parseInt(paidById),
          projectId: projectId === "none" ? null : parseInt(projectId),
          category,
          date: new Date(date + "T12:00:00"),
        }),
      });
      if (res.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "INCOME" ? "Добавить приход" : "Добавить расход"}
          </DialogTitle>
          <DialogDescription>
            Заполните данные транзакции
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              className={type === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700 flex-1" : "flex-1"}
              onClick={() => setType("INCOME")}
            >
              Приход
            </Button>
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className={type === "EXPENSE" ? "bg-red-600 hover:bg-red-700 flex-1" : "flex-1"}
              onClick={() => setType("EXPENSE")}
            >
              Расход
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Сумма ({type === "INCOME" ? "приход" : "расход"})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Описание</Label>
            <Input
              id="desc"
              placeholder="Например: оплата хостинга"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Кто {type === "INCOME" ? "получил" : "потратил"}</Label>
            <Select value={paidById} onValueChange={(v) => v != null && setPaidById(v)}>
              <SelectTrigger>
                <SelectValue>
                  {paidById === "1" ? "Лёша" : paidById === "2" ? "Гена" : "—"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Лёша</SelectItem>
                <SelectItem value="2">Гена</SelectItem>
                <SelectItem value="3">—</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={projectId} onValueChange={(v) => v != null && setProjectId(v)}>
              <SelectTrigger>
                <SelectValue>
                  {projectId === "none"
                    ? "Без проекта"
                    : projects.find((p) => String(p.id) === projectId)?.name ?? "Без проекта"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без проекта</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Категория</Label>
            <Select value={category} onValueChange={(v) => v != null && setCategory(v)}>
              <SelectTrigger>
                <SelectValue>
                  {category}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className={type === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}