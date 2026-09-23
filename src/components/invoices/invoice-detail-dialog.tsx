"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  FileText,
  Image,
  CreditCard,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface Project {
  id: number;
  name: string;
  slug: string;
}

interface Invoice {
  id: number;
  description: string;
  amount: string;
  projectId: number | null;
  project: Project | null;
  status: string;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  paidById: number | null;
  dueDate: string | null;
  invoiceFile: string | null;
  receiptFile: string | null;
  paidDate: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdById: number;
  createdAt: string;
}

interface InvoiceDetailDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When true (history viewer), hides manage actions (mark paid, cancel, restore). */
  readOnly?: boolean;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="badge badge-warn">🟡 Ожидает</span>
      );
    case "PAID":
      return (
        <span className="badge badge-success">🟢 Оплачен</span>
      );
    case "CANCELLED":
      return (
        <span className="badge badge-neutral">⚫ Обнулён</span>
      );
    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
}

function FilePreview({ filePath, fileName }: { filePath: string; fileName: string }) {
  const url = `/uploads${filePath}`;
  const isImage = /\.(jpg|jpeg|png)$/i.test(filePath);
  const isPdf = /\.pdf$/i.test(filePath);

  return (
    <div className="box stack-sm">
      <div className="card-title-row">
        {isImage ? <Image className="icon-xs" /> : <FileText className="icon-xs" />}
        <span className="mini-item-title" style={{ flex: 1 }}>{fileName}</span>
      </div>
      {isImage && (
        <img src={url} alt={fileName} className="img-preview" />
      )}
      {isPdf && (
        <div className="card-title-row">
          <FileText className="icon-xs" />
          <span className="page-sub">PDF файл</span>
        </div>
      )}
          <a href={url} download className="btn-link">
        <Download className="icon-xs" />
        Скачать
      </a>
    </div>
  );
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
  readOnly = false,
}: InvoiceDetailDialogProps) {
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paidDate, setPaidDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [paidById, setPaidById] = useState<string>("1");
  const [currentUserId, setCurrentUserId] = useState<string>("1");
  const [partners, setPartners] = useState<{ id: number; name: string }[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setShowReceiptUpload(false);
      setShowCancelForm(false);
      setReceiptFile(null);
      setPaidDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("CASH");
      setPaidById(currentUserId || "1");
      setCancelReason("");
      setError("");
    }
  }, [open, currentUserId]);

  useEffect(() => {
    fetch("/api/finance/balance")
      .then((r) => r.json())
      .then(() => {})
      .catch(() => {});
    // Fetch the current authenticated user so the mark-paid default reflects
    // who is actually logged in (instead of hardcoded "1").
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        const id = data?.user?.id;
        if (id != null) {
          setCurrentUserId(String(id));
          setPaidById(String(id));
        }
      })
      .catch(() => {});
    fetch("/api/settings/telegram")
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setPartners(data.users.filter((u: { id: number }) => u.id === 1 || u.id === 2));
        }
      })
      .catch(() => {});
  }, []);

  const handleMarkPaid = async () => {
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      if (receiptFile) formData.append("receipt", receiptFile);
      formData.append("paidDate", paidDate);
      formData.append("paymentMethod", paymentMethod);
      formData.append("paidById", paidById);

      const res = await fetch(`/api/invoices/${invoice.id}/paid`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка");
        return;
      }

      setShowReceiptUpload(false);
      setReceiptFile(null);
      onSuccess();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError("Укажите причину обнуления");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка");
        return;
      }

      setShowCancelForm(false);
      setCancelReason("");
      onSuccess();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/restore`, {
        method: "POST",
      });
      if (res.ok) onSuccess();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить счёт безвозвратно?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (res.ok) onSuccess();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const getFileName = (path: string) => path.split("/").pop() || "file";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>
            <span className="card-title-row">
              Счёт #{invoice.invoiceNumber ?? invoice.id}
              <StatusBadge status={invoice.status} />
            </span>
          </DialogTitle>
          <DialogDescription>{invoice.description}</DialogDescription>
        </DialogHeader>

        <div className="stack">
          {/* Info */}
          <div className="info-grid">
            <div>
              <span className="hint">Сумма</span>
              <p className="stat-value">{formatMoney(Number(invoice.amount))}</p>
            </div>
            <div>
              <span className="hint">Проект</span>
              <p className="cell-strong">{invoice.project?.name ?? "—"}</p>
            </div>
            <div>
              <span className="hint">Дата создания</span>
              <p>{formatDate(invoice.createdAt)}</p>
            </div>
            <div>
              <span className="hint">Срок оплаты</span>
              <p>{formatDate(invoice.dueDate)}</p>
            </div>
            {invoice.paidDate && (
              <div>
                <span className="hint">Оплачен</span>
                <p>{formatDate(invoice.paidDate)}</p>
              </div>
            )}
            {invoice.paymentMethod && (
              <div>
                <span className="hint">Способ оплаты</span>
                <p>{invoice.paymentMethod === "BANK_TRANSFER" ? "Банковский перевод" : "Наличные"}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Invoice file */}
          <div>
            <h4 className="h4-title">Счёт</h4>
            {invoice.invoiceFile ? (
              <FilePreview
                filePath={invoice.invoiceFile}
                fileName={getFileName(invoice.invoiceFile)}
              />
            ) : (
              <p className="page-sub">Файл не загружен</p>
            )}
          </div>

          {/* Receipt file (if PAID) */}
          {invoice.status === "PAID" && invoice.receiptFile && (
              <div>
                <h4 className="h4-title">Чек</h4>
              <FilePreview
                filePath={invoice.receiptFile}
                fileName={getFileName(invoice.receiptFile)}
              />
            </div>
          )}

          {/* Cancel reason (if CANCELLED) */}
          {invoice.status === "CANCELLED" && invoice.cancelReason && (
            <div className="warn-box">
              <div className="card-title-row" style={{ marginBottom: 4 }}>
                <AlertTriangle className="icon-xs" />
                Причина обнуления
              </div>
              <p className="page-sub">{invoice.cancelReason}</p>
              <p className="hint" style={{ marginTop: 4 }}>
                Обнулён: {formatDate(invoice.cancelledAt)}
              </p>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="filter-bar">
            {/* Download ZIP */}
            {invoice.invoiceFile && invoice.receiptFile && (
              <a href={`/api/invoices/${invoice.id}/zip`} className="btn-link">
                  <Download className="icon-xs" />
                  Скачать оба (ZIP)
                </a>
            )}

            {/* Mark as paid */}
            {!readOnly && invoice.status === "PENDING" && (
              <Button
                size="sm"
                onClick={() => setShowReceiptUpload(!showReceiptUpload)}
              >
                <CreditCard className="icon-xs" />
                Оплачено — приложить чек
              </Button>
            )}

            {/* Restore */}
            {!readOnly && invoice.status === "CANCELLED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestore}
                disabled={loading}
              >
                <RotateCcw className="icon-xs" />
                Восстановить
              </Button>
            )}

            {/* Cancel (for PENDING) */}
            {!readOnly && invoice.status === "PENDING" && !showCancelForm && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowCancelForm(true)}
              >
                <Trash2 className="icon-xs" />
                Обнулить счёт
              </Button>
            )}

            {/* Hard delete */}
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                className="btn-text-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                Удалить
              </Button>
            )}
          </div>

          {/* Receipt upload form */}
          {showReceiptUpload && (
            <div className="box stack-sm">
              <h4 className="h4-title">Отметить оплату</h4>
              <div className="form-grid-2">
                <div className="form-row">
                  <Label>Способ оплаты</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as "CASH" | "BANK_TRANSFER")}
                    items={[
                      { value: "CASH", label: "Наличные" },
                      { value: "BANK_TRANSFER", label: "Банковский перевод" },
                    ]}
                  >
                    <SelectTrigger className="select-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Наличные</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Банковский перевод</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-row">
                  <Label>Кто получил деньги</Label>
                  <Select
                    value={paidById}
                    onValueChange={(v) => setPaidById(v ?? "1")}
                    items={
                      partners.length > 0
                        ? partners.map((p) => ({ value: String(p.id), label: p.name }))
                        : [
                            { value: "1", label: "Лёша" },
                            { value: "2", label: "Гена" },
                          ]
                    }
                  >
                    <SelectTrigger className="select-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.length > 0 ? (
                        partners.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="1">Лёша</SelectItem>
                          <SelectItem value="2">Гена</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="form-row">
                <Label htmlFor="paidDate">Дата оплаты</Label>
                <Input
                  id="paidDate"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
              {paymentMethod === "BANK_TRANSFER" && (
                <p className="warn-box warn-box--amber">
                  Автоматически будет создан расход «Налог 6%» от суммы счёта.
                </p>
              )}
              <div className="form-row">
                <Label>Чек (необязательно)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="file-input"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </div>
              {error && <p className="text-neg">{error}</p>}
              <div className="form-actions">
                <Button
                  size="sm"
                  onClick={handleMarkPaid}
                  disabled={loading}
                >
                  {loading ? "Загрузка..." : "Подтвердить оплату"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowReceiptUpload(false); setReceiptFile(null); setError(""); }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Cancel form */}
          {showCancelForm && (
            <div className="warn-box warn-box--danger">
              <h4 className="h4-title card-title-row">
                <AlertTriangle className="icon-xs" />
                Обнулить счёт
              </h4>
              <div className="form-row">
                <Label htmlFor="cancelReason">Причина обнуления *</Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Укажите причину..."
                  rows={3}
                />
              </div>
              {error && <p className="text-neg">{error}</p>}
              <div className="form-actions">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading || !cancelReason.trim()}
                >
                  {loading ? "Выполняется..." : "Обнулить"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowCancelForm(false); setCancelReason(""); setError(""); }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
