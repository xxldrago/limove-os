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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface ExUser {
  id: number;
  fullName: string;
  login: string;
  registerDate: string;
  paidDate: string | null;
  company: string | null;
  status: string;
  notes: string | null;
}

const STATUSES = ["PAID", "TRIAL", "READY_UNPAID", "NOT_INSTALLED", "EXPIRED"];

function toDate(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ExUser | null;
  onSuccess: () => void;
}

export function ElementxDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [registerDate, setRegisterDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("TRIAL");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // income transaction prompt
  const [wasStatus, setWasStatus] = useState<string | null>(null);
  const [askIncome, setAskIncome] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (open) {
      setFullName(user?.fullName ?? "");
      setLogin(user?.login ?? "");
      setRegisterDate(toDate(user?.registerDate) || new Date().toISOString().slice(0, 10));
      setPaidDate(toDate(user?.paidDate));
      setCompany(user?.company ?? "");
      setStatus(user?.status ?? "TRIAL");
      setNotes(user?.notes ?? "");
      setWasStatus(user?.status ?? null);
      setAskIncome(false);
      setAmount("");
      setDesc("");
      setError("");
    }
  }, [open, user]);

  async function handleSubmit(createTransaction: boolean) {
    if (!fullName.trim() || !login.trim()) {
      setError("Имя и логин обязательны");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        fullName: fullName.trim(),
        login: login.trim(),
        registerDate,
        paidDate: paidDate || null,
        company: company.trim() || null,
        status,
        notes: notes.trim() || null,
      };
      let res;
      if (user) {
        res = await fetch(`/api/elementx/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/elementx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const j = await res.json();
        setError(j.error || "Ошибка сохранения");
        return;
      }

      let created: ExUser;
      if (user) created = { ...user, ...body };
      else created = await res.json();

      // If transitioning to PAID and user wants an income transaction
      if (createTransaction && created.id) {
        await fetch(`/api/elementx/${created.id}/create-transaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            description: desc || `Оплата ElementX: ${created.fullName}`,
            createTransaction: true,
          }),
        });
      }
      onSuccess();
    } catch (e) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveClick() {
    const isNewPaid = status === "PAID" && wasStatus !== "PAID";
    if (isNewPaid) {
      setAskIncome(true);
    } else {
      handleSubmit(false);
    }
  }

  if (askIncome) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Создать доход?</DialogTitle>
            <DialogDescription>
              Статус изменён на PAID. Записать доходную транзакцию в финансы?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Сумма (₽)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
            </div>
            <div className="space-y-1.5">
              <Label>Описание</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={`Оплата ElementX: ${fullName || ""}`} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleSubmit(false)}
            >
              Нет
            </Button>
            <Button
              disabled={loading || !amount}
              onClick={() => handleSubmit(true)}
            >
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Да, создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Редактировать пользователя" : "Добавить пользователя"}</DialogTitle>
          <DialogDescription>
            {user ? "Измените данные пользователя ElementX" : "Новый пользователь ElementX"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Полное имя</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Вадим Исмагилович" />
          </div>
          <div className="space-y-1.5">
            <Label>Логин</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="vi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Дата регистрации</Label>
              <Input type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Дата оплаты <span className="text-muted-foreground">(опц.)</span></Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Компания <span className="text-muted-foreground">(опц.)</span></Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="РС" />
          </div>
          <div className="space-y-1.5">
            <Label>Статус</Label>
            <Select value={status} onValueChange={(v) => { if (v != null) setStatus(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Заметки <span className="text-muted-foreground">(опц.)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSaveClick} disabled={loading}>
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}