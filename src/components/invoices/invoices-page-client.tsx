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
      return (
        <Badge variant="outline" className="border-[rgba(251,191,36,0.4)] text-[#FBBF24] bg-[rgba(251,191,36,0.1)]">
          🟡 Ожидает
        </Badge>
      );
    case "PAID":
      return (
        <Badge variant="outline" className="border-[#34D399] text-[#34D399] bg-[rgba(52,211,153,0.1)]">
          🟢 Оплачен
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="border-[#263147] text-[#94A3B8] bg-[#131926]">
          ⚫ Обнулён
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
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

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    const res = await fetch(`/api/invoices?${params}`);
    if (res.ok) {
      const data = await res.json();
      setInvoices(data);
    }
    setLoading(false);
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
  useEffect(() => {
    fetch("/api/invoices").then((r) => r.json()).then(setAllInvoices);
  }, [selectedInvoice]);

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
    >

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ожидают оплаты</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FBBF24]">{pendingInvoices.length}</div>
            <p className="text-sm text-muted-foreground">{formatMoney(pendingSum)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Оплачено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#34D399]">{paidInvoices.length}</div>
            <p className="text-sm text-muted-foreground">{formatMoney(paidSum)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Обнулено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#94A3B8]">{cancelledInvoices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
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
        </div>

        {/* Advanced filters: project, date range, amount range */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Проект</Label>
            <Select
              value={filterProject}
              onValueChange={(v) => v != null && setFilterProject(v)}
              items={[
                { value: "ALL", label: "Все проекты" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            >
              <SelectTrigger className="h-8 text-xs">
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">С даты</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">По дату</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Мин. сумма</Label>
            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Макс. сумма</Label>
            <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : visibleInvoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Нет счетов</div>
      ) : (
        <Card>
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">№</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Проект</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <TableCell className="font-mono text-muted-foreground">{invoice.invoiceNumber ?? invoice.id}</TableCell>
                  <TableCell className="font-medium">{invoice.description}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(Number(invoice.amount))}</TableCell>
                  <TableCell>{invoice.project?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.createdAt)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
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
