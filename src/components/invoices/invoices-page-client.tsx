"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  CreditCard,
  RotateCcw,
  Trash2,
  Eye,
  Filter,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FernPage } from "@/components/fern/fern-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceDetailDialog } from "@/components/invoices/invoice-detail-dialog";
import { UploadInvoiceDialog } from "@/components/invoices/upload-invoice-dialog";

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

type FilterStatus = "ALL" | "PENDING" | "PAID" | "CANCELLED";

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
      return <span className="badge badge-warn">🟡 Ожидает</span>;
    case "PAID":
      return <span className="badge badge-success">🟢 Оплачен</span>;
    case "CANCELLED":
      return <span className="badge badge-neutral">⚫ Обнулён</span>;
    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
}

export function InvoicesPageClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [filterProject, setFilterProject] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchInvoices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    const res = await fetch(`/api/invoices?${params}`);
    if (res.ok) {
      const data = await res.json();
      setInvoices(data);
    }
    if (!silent) setLoading(false);
  }, [filter]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.map((p: Project & { slug: string }) => ({ id: p.id, name: p.name, slug: p.slug })));
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Compute stats from ALL invoices (not filtered)
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const fetchAllInvoices = useCallback(async () => {
    try {
      const r = await fetch("/api/invoices");
      if (r.ok) setAllInvoices(await r.json());
    } catch {
      /* ignore background refresh errors */
    }
  }, []);
  useEffect(() => {
    fetchAllInvoices();
  }, [fetchAllInvoices, selectedInvoice]);

  // Автообновление: второй партнёр мог оплатить счёт со своего устройства.
  // Без этого страница показывает stale-статус («не оплачен»), пока не
  // перезагрузишь вручную.
  useEffect(() => {
    const refresh = () => {
      fetchInvoices(true);
      fetchAllInvoices();
    };
    const timer = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchInvoices, fetchAllInvoices]);

  const pendingInvoices = allInvoices.filter((i) => i.status === "PENDING");
  const paidInvoices = allInvoices.filter((i) => i.status === "PAID");
  const cancelledInvoices = allInvoices.filter((i) => i.status === "CANCELLED");

  const pendingSum = pendingInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidSum = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: "Все", value: "ALL" },
    { label: "Ожидают", value: "PENDING" },
    { label: "Оплачены", value: "PAID" },
    { label: "Обнулены", value: "CANCELLED" },
  ];

  // Client-side filters: project, date range, amount range (applied on top of status filter)
  const visibleInvoices = invoices.filter((inv) => {
    if (filterProject !== "ALL" && Number(inv.projectId) !== Number(filterProject)) return false;
    const d = new Date(inv.createdAt);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    const amt = Number(inv.amount);
    if (minAmount && amt < Number(minAmount)) return false;
    if (maxAmount && amt > Number(maxAmount)) return false;
    return true;
  });

  return (
    <>
    <FernPage
      title="Счета"
      sub="История счетов и чеков. Управление — в разделе «Финансы»."
      total={pendingSum > 0 ? formatMoney(pendingSum) : undefined}
      tools={
        <Button onClick={() => setUploadOpen(true)} className="btn-tall">
          <Plus className="icon-xs" /> Добавить счёт / чек
        </Button>
      }
    >
      {/* Сводка */}
      <div className="grid-3">
        <div className="card">
          <div className="stat-label">Ожидают оплаты</div>
          <div className="stat-value" style={{ color: "#FBBF24" }}>{pendingInvoices.length}</div>
          <p className="page-sub">{formatMoney(pendingSum)}</p>
        </div>
        <div className="card">
          <div className="stat-label">Оплачено</div>
          <div className="stat-value stat-value--pos">{paidInvoices.length}</div>
          <p className="page-sub">{formatMoney(paidSum)}</p>
        </div>
        <div className="card">
          <div className="stat-label">Обнулено</div>
          <div className="stat-value">{cancelledInvoices.length}</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="filter-bar">
          <Filter className="icon-xs" />
          {filterButtons.map((fb) => (
            <Button
              key={fb.value}
              variant={filter === fb.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(fb.value)}
            >
              {fb.label}
            </Button>
          ))}
        </div>

        <div className="filter-grid">
          <div className="form-row">
            <Label>Проект</Label>
            <Select
              value={filterProject}
              onValueChange={(v) => v != null && setFilterProject(v)}
              items={[
                { value: "ALL", label: "Все проекты" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все проекты</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-row">
            <Label>С даты</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="form-row">
            <Label>По дату</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="form-row">
            <Label>Мин. сумма</Label>
            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="form-row">
            <Label>Макс. сумма</Label>
            <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
          </div>
        </div>
      </div>

      {/* Таблица */}
      {loading ? (
        <div className="empty-state">Загрузка...</div>
      ) : visibleInvoices.length === 0 ? (
        <div className="empty-state">Нет счетов</div>
      ) : (
        <div className="card card-flush">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead className="number-cell">Сумма</TableHead>
                <TableHead>Проект</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="number-cell">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="row-clickable"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <TableCell className="num">{invoice.invoiceNumber ?? invoice.id}</TableCell>
                  <TableCell className="cell-strong">{invoice.description}</TableCell>
                  <TableCell className="number-cell">{formatMoney(Number(invoice.amount))}</TableCell>
                  <TableCell>{invoice.project?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="num">{formatDate(invoice.createdAt)}</TableCell>
                  <TableCell className="number-cell" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(invoice)} aria-label="Открыть счёт">
                      <Eye className="icon-xs" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UploadInvoiceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projects={projects}
        onSuccess={() => {
          setUploadOpen(false);
          fetchInvoices();
        }}
      />

      {selectedInvoice && (
        <InvoiceDetailDialog
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          readOnly
          onOpenChange={(open) => {
            if (!open) setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </FernPage>
    </>
  );
}
