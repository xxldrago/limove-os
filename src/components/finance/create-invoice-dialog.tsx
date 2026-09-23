"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Loader2, Upload, FileText, X } from "lucide-react";

interface Project {
  id: number;
  name: string;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onSuccess: () => void;
  /** Optional: pre-select a project when the dialog opens. */
  initialProjectId?: number;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  projects,
  onSuccess,
  initialProjectId,
}: CreateInvoiceDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setProjectId("none");
    setFile(null);
    setDragging(false);
    setError("");
  };

  // Pre-select project when dialog opens with an initialProjectId; otherwise
  // reset form fields to defaults.
  useEffect(() => {
    if (open) {
      setDescription("");
      setAmount("");
      setFile(null);
      setDragging(false);
      setError("");
      if (initialProjectId) {
        setProjectId(String(initialProjectId));
      } else {
        setProjectId("none");
      }
    }
  }, [open, initialProjectId]);

  const handleFile = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError("Допустимые форматы: PDF, JPG, PNG");
        return;
      }
      if (f.size > MAX_SIZE) {
        setError("Файл больше 10MB");
        return;
      }
      setError("");
      setFile(f);
    },
    []
  );

  // Nice-to-have: when project changes and amount is empty, auto-fill amount
  // from the project's most recent invoice.
  useEffect(() => {
    if (!open || projectId === "none" || amount.trim() !== "") return;
    let cancelled = false;
    fetch("/api/invoices")
      .then((r) => (r.ok ? r.json() : []))
      .then((invoices: { project: { id: number } | null; amount: string }[]) => {
        if (cancelled) return;
        const id = Number(projectId);
        const latest = invoices.find((inv) => inv.project?.id === id);
        if (!latest) return;
        const amt = Number(latest.amount);
        if (!Number.isNaN(amt) && amt > 0) {
          setAmount(String(amt));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, projectId, amount]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Введите описание");
      return;
    }
    if (!amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Укажите корректную сумму");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("description", description.trim());
      formData.append("amount", amount);
      if (projectId !== "none") formData.append("projectId", projectId);
      if (file) formData.append("file", file);

      const res = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка создания счёта");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать счёт</DialogTitle>
          <DialogDescription>
            Номер будет присвоен автоматически (INV-XXXX), статус — «Ожидает».
          </DialogDescription>
        </DialogHeader>
        <div className="stack">
          <div className="form-row">
            <Label>Проект</Label>
            <Select
              value={projectId}
              onValueChange={(v) => setProjectId(v ?? "none")}
              items={[
                { value: "none", label: "Без проекта" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            >
              <SelectTrigger className="select-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без проекта</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-row">
            <Label>Сумма (₽)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="form-row">
            <Label>Описание</Label>
            <Input
              placeholder="Оплата за разработку"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-row">
            <Label>Файл счёта (необязательно)</Label>
            <div
              className={dragging ? "dropzone is-over" : "dropzone"}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              {file ? (
                <div className="row-center">
                  <FileText className="icon-xs text-pos" />
                  <span className="truncate-220">{file.name}</span>
                  <button
                    type="button"
                    className="hint"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Убрать файл"
                  >
                    <X className="icon-xs" />
                  </button>
                </div>
              ) : (
                <p className="page-sub">
                  Перетащите файл сюда
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden-input"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                style={{ marginTop: 12 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="icon-xs" />
                Загрузить файл
              </Button>
            </div>
            {file && (
              <p className="hint">
                PDF, JPG, PNG · до 10 МБ
              </p>
            )}
          </div>
          {error && <p className="text-neg">{error}</p>}
          <div className="form-actions form-actions--end">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="icon-xs" />
                  Создание...
                </>
              ) : (
                "Создать счёт"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}