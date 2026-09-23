"use client";

import { useState, useRef } from "react";
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
import { Loader2, Upload, X } from "lucide-react";

interface Project {
  id: number;
  name: string;
}

interface UploadInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onSuccess: () => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadInvoiceDialog({
  open,
  onOpenChange,
  projects,
  onSuccess,
}: UploadInvoiceDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [paidDate, setPaidDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setProjectId("none");
    setDueDate("");
    setStatus("PENDING");
    setPaidDate("");
    setFile(null);
    setReceipt(null);
    setError("");
  };

  const handleFile = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Допустимые форматы: PDF, JPG, PNG");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("Максимальный размер файла: 10 МБ");
      return;
    }
    setFile(f);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) {
      setError("Заполните описание и сумму");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("description", description.trim());
      formData.append("amount", amount);
      if (projectId && projectId !== "none") formData.append("projectId", projectId);
      if (dueDate) formData.append("dueDate", dueDate);
      formData.append("status", status);
      if (status === "PAID" && paidDate) formData.append("paidDate", paidDate);
      if (file) formData.append("file", file);
      if (receipt) formData.append("receipt", receipt);

      const res = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка создания");
        return;
      }

      resetForm();
      onSuccess();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить счёт / чек</DialogTitle>
          <DialogDescription>Перенос старых счетов и чеков — в приход/расход не попадает</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="stack">
          <div className="form-row">
            <Label htmlFor="description">Описание *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: Счёт за хостинг"
              required
            />
          </div>

          <div className="form-row">
            <Label htmlFor="amount">Сумма (₽) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-row">
            <Label>Проект</Label>
            <Select
              value={projectId}
              onValueChange={(v) => v != null && setProjectId(v)}
              items={[
                { value: "none", label: "Без проекта" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            >
              <SelectTrigger>
                <SelectValue placeholder="Без проекта" />
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
            <Label htmlFor="dueDate">Срок оплаты</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <Label>Статус счёта</Label>
            <Select
              value={status}
              onValueChange={(v) => v != null && setStatus(v)}
              items={[
                { value: "PENDING", label: "Ожидает оплаты" },
                { value: "PAID", label: "Оплачен" },
                { value: "CANCELLED", label: "Обнулён" },
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Ожидает оплаты</SelectItem>
                <SelectItem value="PAID">Оплачен</SelectItem>
                <SelectItem value="CANCELLED">Обнулён</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "PAID" && (
            <>
              <div className="form-row">
                <Label htmlFor="paidDate">Дата оплаты</Label>
                <Input
                  id="paidDate"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
              <div className="form-row">
                <Label>Чек (необязательно)</Label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="file-input"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                />
              </div>
            </>
          )}

          <div className="form-row">
            <Label>Файл счёта</Label>
            <div
              className={`dropzone${dragOver ? " is-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFile(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="row-center">
                  <span className="cell-strong">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <X className="icon-xs" />
                  </Button>
                </div>
              ) : (
                <div className="drop-hint">
                  <Upload className="drop-hint-icon" />
                  <p className="cell-strong">Перетащите файл или нажмите для выбора</p>
                  <p className="hint">PDF, JPG, PNG — макс. 10 МБ</p>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-neg">{error}</p>}

          <div className="form-actions form-actions--end">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="icon-xs" />}
              Загрузить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
