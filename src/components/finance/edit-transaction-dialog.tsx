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
import { Loader2 } from "lucide-react";

interface Project {
  id: number;
  name: string;
  slug: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  description: string;
  paidById: number;
  projectId: number | null;
  category: string;
  date: string;
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

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  projects: Project[];
  onSuccess: () => void;
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  projects,
  onSuccess,
}: EditTransactionDialogProps) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidById, setPaidById] = useState<string>("1");
  const [projectId, setProjectId] = useState<string>("none");
  const [category, setCategory] = useState<string>("Другое");
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && transaction) {
      setType(transaction.type === "INCOME" ? "INCOME" : "EXPENSE");
      setAmount(String(transaction.amount));
      setDescription(transaction.description);
      setPaidById(String(transaction.paidById));
      setProjectId(transaction.projectId ? String(transaction.projectId) : "none");
      setCategory(transaction.category);
      setDate(new Date(transaction.date).toISOString().slice(0, 10));
      setError("");
    }
  }, [open, transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) {
      setError("Заполните сумму и описание");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/transactions/${transaction.id}`, {
        method: "PUT",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать транзакцию</DialogTitle>
          <DialogDescription>Измените данные транзакции</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="stack">
          <div className="form-actions">
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              className={type === "INCOME" ? "btn-solid-ok flex-1" : "flex-1"}
              onClick={() => setType("INCOME")}
            >
              Приход
            </Button>
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className={type === "EXPENSE" ? "bg-[#F87171] hover:bg-[#EF4444] flex-1" : "flex-1"}
              onClick={() => setType("EXPENSE")}
            >
              Расход
            </Button>
          </div>

          <div className="form-row">
            <Label htmlFor="amount">Сумма</Label>
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

          <div className="form-row">
            <Label htmlFor="desc">Описание</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
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

          <div className="form-row">
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

          <div className="form-row">
            <Label>Категория</Label>
            <Select value={category} onValueChange={(v) => v != null && setCategory(v)}>
              <SelectTrigger>
                <SelectValue>{category}</SelectValue>
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

          <div className="form-row">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && <div className="text-neg">{error}</div>}

          <div className="form-actions form-actions--end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="icon-xs" /> : null}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}