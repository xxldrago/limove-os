"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Zap, CreditCard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FernPage } from "@/components/fern/fern-page";
import { AddTransactionDialog } from "@/components/finance/add-transaction-dialog";
import { EditTransactionDialog } from "@/components/finance/edit-transaction-dialog";
import { DeleteConfirmDialog } from "@/components/finance/delete-confirm-dialog";
import { PartnerBalanceCard } from "@/components/finance/partner-balance-card";
import { ExpenseTemplates } from "@/components/finance/expense-templates";
import { FinancialGoalCard } from "@/components/finance/financial-goal-card";
import { ForecastCard, MarginsRankCard } from "@/components/finance/margins-card";
import { CreateInvoiceDialog } from "@/components/finance/create-invoice-dialog";
import { InvoiceDetailDialog } from "@/components/invoices/invoice-detail-dialog";
import { FileText } from "lucide-react";

interface CategoryStat {
  category: string;
  amount: number;
  count: number;
  pct: number;
}

/** Донат Fernbrook: доля расходов от дохода за месяц. */
function ExpenseDonut({ pct }: { pct: number }) {
  const r = 63;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const over = pct > 100;
  return (
    <svg
      width="168"
      height="168"
      viewBox="0 0 168 168"
      role="img"
      aria-label="Доля расходов от дохода"
      className="mx-auto mt-[34px] block drop-shadow-[0_16px_26px_rgba(45,139,163,0.22)]"
    >
      <circle cx="84" cy="84" r={r} fill="none" stroke="#dceef3" strokeWidth="42" />
      <circle
        cx="84"
        cy="84"
        r={r}
        fill="none"
        stroke={over ? "#d4674e" : "#2d8ba3"}
        strokeWidth="42"
        strokeDasharray={`${(c * clamped) / 100} ${c}`}
        transform="rotate(-90 84 84)"
      />
    </svg>
  );
}

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
  paidBy: { id: number; name: string };
  projectId: number | null;
  project: { id: number; name: string; slug: string } | null;
  category: string;
  date: string;
  createdAt: string;
}

interface BalanceData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  settled: boolean;
  settledAmount: number;
  debt: number;
  debtor: string;
  creditor: string;
  partners: {
    lesha: { name: string; share: number; spent: number; received: number; net: number; balance: number };
    gena: { name: string; share: number; spent: number; received: number; net: number; balance: number };
  };
}

interface InvoiceItem {
  id: number;
  description: string;
  amount: string;
  projectId: number | null;
  project: { id: number; name: string; slug: string } | null;
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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    months.push({ value: val, label });
  }
  return months;
}

export function FinancePageClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);

  // Filters
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterMonth, setFilterMonth] = useState<string>(getCurrentMonth());
  const [filterPartner, setFilterPartner] = useState<string>("ALL");
  const [filterProject, setFilterProject] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  // Dialogs
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);
    const [prefillData, setPrefillData] = useState<{
      type?: "INCOME" | "EXPENSE";
      amount?: string;
      description?: string;
      category?: string;
    } | null>(null);

    // Invoices (for create + pending summary + mark-paid)
        const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
        const [pendingInvoices, setPendingInvoices] = useState<{ count: number; sum: number }>({ count: 0, sum: 0 });
        const [pendingInvoiceList, setPendingInvoiceList] = useState<InvoiceItem[]>([]);
                const [manageInvoice, setManageInvoice] = useState<InvoiceItem | null>(null);

        const fetchPendingInvoices = useCallback(async () => {
          try {
            const res = await fetch("/api/invoices?status=PENDING");
            if (res.ok) {
              const data = await res.json();
              const count = data.length;
              const sum = data.reduce((acc: number, inv: { amount: string }) => acc + Number(inv.amount), 0);
              setPendingInvoices({ count, sum });
              setPendingInvoiceList(data);
            }
          } catch {
            // ignore
          }
        }, []);

    useEffect(() => {
      fetchPendingInvoices();
    }, [fetchPendingInvoices]);

    const categories = [
      "Обслужка",
      "Налог",
      "Хостинг",
      "Подписка",
      "VPN",
      "Продвижение",
      "Другое",
    ];

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType !== "ALL") params.set("type", filterType);
    if (filterMonth) params.set("month", filterMonth);
    if (filterPartner !== "ALL") params.set("paidById", filterPartner);
    if (filterProject !== "ALL") params.set("projectId", filterProject);
    if (filterCategory !== "ALL") params.set("category", filterCategory);
    try {
      const res = await fetch(`/api/finance/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch {
      // ignore
    }
  }, [filterType, filterMonth, filterPartner, filterProject, filterCategory]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/balance?month=${filterMonth}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      }
    } catch {
      // ignore
    }
  }, [filterMonth]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/categories?month=${filterMonth}&type=EXPENSE`);
      if (res.ok) {
        const data = await res.json();
        setCategoryStats(data.categories ?? []);
      }
    } catch {
      // ignore
    }
  }, [filterMonth]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchTransactions();
    fetchBalance();
    fetchCategories();
  }, [fetchTransactions, fetchBalance, fetchCategories]);

  const handleAddClick = (type: "INCOME" | "EXPENSE") => {
    setAddDialogType(type);
    setPrefillData(null);
    setAddDialogOpen(true);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleDelete = (transaction: Transaction) => {
    setDeleteTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const handleUseTemplate = (template: {
    name: string;
    amount: string;
    category: string;
  }) => {
    setAddDialogType("EXPENSE");
    setPrefillData({
      type: "EXPENSE",
      amount: template.amount,
      description: template.name,
      category: template.category,
    });
    setAddDialogOpen(true);
  };

  const handleQuickAdd = async (template: {
    name: string;
    amount: string;
    category: string;
  }) => {
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "EXPENSE",
          amount: parseFloat(template.amount),
          description: template.name,
          paidById: 1,
          category: template.category,
          date: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        fetchTransactions();
        fetchBalance();
        fetchCategories();
      }
    } catch {
      // ignore
    }
  };

  const monthOptions = getMonthOptions();
  const usedCategories = [...new Set([...categories, ...transactions.map((t) => t.category)])];

  const monthLabel = (() => {
    const [y, m] = filterMonth.split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  const expensePct = balance
    ? balance.totalIncome > 0
      ? Math.round((balance.totalExpenses / balance.totalIncome) * 100)
      : balance.totalExpenses > 0
        ? 100
        : 0
    : 0;

  return (
    <>
    <FernPage
      title="Финансы"
      sub={balance ? `Прибыль за месяц: ${formatMoney(balance.profit)}` : "Доходы, расходы и счета"}
      total={balance ? formatMoney(balance.totalIncome) : undefined}
      tools={
        <>
          <Button onClick={() => handleAddClick("INCOME")} className="h-10 rounded-[12px] bg-[#1f8a5c] px-[18px] text-white hover:bg-[#177245]">
            <Plus className="mr-2 h-4 w-4" /> Приход
          </Button>
          <Button onClick={() => handleAddClick("EXPENSE")} className="h-10 rounded-[12px] bg-[#16548f] px-[18px] text-white hover:bg-[#1c68ad]">
            <Plus className="mr-2 h-4 w-4" /> Расход
          </Button>
          <Button onClick={() => setCreateInvoiceOpen(true)} variant="outline" className="h-10 rounded-[12px] px-[18px]">
            <FileText className="mr-2 h-4 w-4" /> Счёт
          </Button>
        </>
      }
    >

      {/* Fernbrook panel: ledger summary + category meters */}
      {balance && (
        <div className="fern-panel overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-[362px_1fr]">
            {/* Ledger summary column */}
            <div className="flex flex-col border-b border-[#e4e9ef] px-6 pb-8 pt-[26px] xl:border-b-0 xl:border-r">
              <div className="mb-6 flex items-center justify-between gap-3 px-1">
                <h2 className="m-0 text-[21px] font-bold tracking-[-0.028em] text-[#0f1720]">
                  {monthLabel}
                </h2>
                <span className="num text-sm text-[#5d6b7c]">{balance.month}</span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex w-full items-center gap-[14px] rounded-[12px] border border-[#e4e9ef] bg-white p-[13px_16px] shadow-[0_1px_2px_rgba(15,23,32,0.05)]">
                  <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-white" style={{ background: "linear-gradient(155deg,#43b47c,#2c8f5f)" }}>
                    <Plus size={19} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15.5px] font-medium tracking-[-0.01em] text-[#354354]">
                    Доход
                    <span className="block text-xs font-normal text-[#8a97a6]">за месяц</span>
                  </span>
                  <span className="num whitespace-nowrap text-[17px] font-bold tracking-[-0.026em] text-[#1f8a5c]">
                    +{formatMoney(balance.totalIncome).replace("−", "")}
                  </span>
                </div>

                <div className="flex w-full items-center gap-[14px] rounded-[12px] border border-[#e4e9ef] bg-white p-[13px_16px] shadow-[0_1px_2px_rgba(15,23,32,0.05)]">
                  <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-white" style={{ background: "linear-gradient(155deg,#6b8fd6,#4a6ec0)" }}>
                    <Trash2 size={19} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15.5px] font-medium tracking-[-0.01em] text-[#354354]">
                    Расходы
                    <span className="block text-xs font-normal text-[#8a97a6]">за месяц</span>
                  </span>
                  <span className="num whitespace-nowrap text-[17px] font-bold tracking-[-0.026em] text-[#0f1720]">
                    −{formatMoney(balance.totalExpenses).replace("−", "")}
                  </span>
                </div>

                <div className="flex w-full items-center gap-[14px] rounded-[12px] border-2 border-[#16548f] bg-[#f7fafd] p-[12px_15px] shadow-[0_1px_2px_rgba(22,84,143,0.1),0_12px_24px_-16px_rgba(22,84,143,0.55)]">
                  <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-white" style={{ background: "linear-gradient(155deg,#5fc6d3,#3aa3b3)" }}>
                    <Zap size={19} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15.5px] font-semibold tracking-[-0.01em] text-[#16548f]">
                    Прибыль
                    <span className="block text-xs font-normal text-[#8a97a6]">доход минус расходы</span>
                  </span>
                  <span className="num whitespace-nowrap text-[17px] font-bold tracking-[-0.026em] text-[#0f3f6d]">
                    {balance.profit >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(balance.profit))}
                  </span>
                </div>
              </div>

              <div className="mx-1 my-7 h-px bg-[#e4e9ef]" />

              <div className="flex items-center gap-[14px] px-1">
                <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-white" style={{ background: "linear-gradient(155deg,#5aa2d8,#3b7fb8)" }}>
                  <TrendingUp size={19} strokeWidth={2.6} />
                </span>
                <div className="min-w-0 flex-1 text-center">
                  <p className="m-0 text-[14.5px] text-[#5d6b7c]">Осталось за месяц</p>
                  <p className={`num m-0 mt-[3px] text-[30px] font-bold leading-none tracking-[-0.038em] ${balance.profit >= 0 ? "text-[#0f1720]" : "text-[#c9563f]"}`}>
                    {balance.profit >= 0 ? "" : "−"}
                    {formatMoney(Math.abs(balance.profit))}
                  </p>
                </div>
              </div>

              <ExpenseDonut pct={expensePct} />
            </div>

            {/* Category buckets with aqua meters */}
            <div className="flex min-w-0 flex-col px-7 pb-8 pt-[26px]">
              <div className="flex flex-wrap items-center gap-4 border-b border-[#eef2f6] pb-5">
                <h2 className="m-0 text-[20px] font-bold tracking-[-0.028em] text-[#0f1720]">Расходы по категориям</h2>
                <span className="num text-[20px] font-semibold tracking-[-0.028em] text-[#354354]">
                  −{formatMoney(balance.totalExpenses).replace("−", "")}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-[10px]">
                  <Link
                    href="#journal"
                    className="hidden h-10 items-center rounded-[12px] border border-[#e4e9ef] px-[14px] text-[15px] font-medium text-[#354354] transition hover:bg-[#f5f8fa] sm:flex"
                  >
                    К журналу
                  </Link>
                  <Button
                    onClick={() => handleAddClick("EXPENSE")}
                    className="h-10 rounded-[12px] bg-[#16548f] px-[18px] text-white hover:bg-[#1c68ad]"
                  >
                    <Plus size={17} strokeWidth={1.9} /> Новый расход
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-6">
                {categoryStats.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    За этот месяц расходов нет
                  </div>
                ) : (
                  categoryStats.map((c) => (
                    <div
                      key={c.category}
                      className="grid grid-cols-[minmax(0,1.36fr)_minmax(0,1.94fr)_minmax(0,0.94fr)] items-center gap-5 rounded-[16px] border border-[#e4e9ef] bg-white px-[22px] py-[18px] shadow-[0_1px_2px_rgba(15,23,32,0.05)] max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-4"
                    >
                      <div>
                        <h3 className="m-0 mb-[5px] text-[16.5px] font-bold tracking-[-0.02em] text-[#0f1720]">{c.category}</h3>
                        <p className="num m-0 text-[13.5px] text-[#5d6b7c]">
                          <b className="font-bold text-[#0f1720]">{c.count}</b> операций · доля{" "}
                          <b className="font-bold text-[#0f1720]">{c.pct}%</b>
                        </p>
                      </div>
                      <div>
                        <div className="num mb-[9px] flex items-baseline justify-between gap-3 text-[13.5px] text-[#5d6b7c]">
                          <span>Потрачено <b className="font-bold text-[#0f1720]">{formatMoney(c.amount)}</b></span>
                          <span>из <b className="font-bold text-[#0f1720]">{formatMoney(balance.totalExpenses)}</b></span>
                        </div>
                        <div className="fern-track">
                          <div className="fern-fill" style={{ width: `${Math.min(100, c.pct)}%` }} />
                        </div>
                      </div>
                      <div className="border-l border-[#eef2f6] pl-6 text-right max-lg:border-l-0 max-lg:pl-0 max-lg:text-left">
                        <p className="num m-0 text-[19px] font-bold tracking-[-0.03em] text-[#0f1720]">{formatMoney(c.amount)}</p>
                        <p className="m-0 mt-[3px] text-[13px] text-[#5d6b7c]">Всего по категории</p>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={() => handleAddClick("EXPENSE")}
                  className="flex items-center rounded-[16px] border border-[#e4e9ef] bg-[#fbfcfd] px-[22px] py-[30px] text-left transition hover:border-[#c3d8ea] hover:bg-[#f6fafd]"
                >
                  <span className="inline-flex items-center gap-[9px] text-[15.5px] font-semibold tracking-[-0.014em] text-[#16548f]">
                    <Plus size={18} /> Новый расход
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Партнёры и счета к оплате — в одной строке */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {balance && <PartnerBalanceCard balance={balance} onSettled={fetchBalance} />}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Ожидают оплаты
            </CardTitle>
            <span className="num text-sm text-[#5d6b7c]">{pendingInvoices.count} сч.</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold whitespace-nowrap text-[#0f3f6d]">
              {formatMoney(pendingInvoices.sum)}
            </div>
            {pendingInvoiceList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет неоплаченных счетов</p>
            ) : (
              <ul className="space-y-2">
                {pendingInvoiceList.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-[#eef2f6] px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {inv.invoiceNumber ?? `INV-${String(inv.id).padStart(4, "0")}`} · {inv.project?.name ?? "—"}
                      </div>
                      <div className="num text-xs text-muted-foreground">{formatMoney(Number(inv.amount))}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setManageInvoice(inv)}>
                      <CreditCard className="mr-1.5 h-4 w-4" /> Оплатить
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Цель, прогноз и маржинальность — в одной строке */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FinancialGoalCard />
        <ForecastCard />
        <MarginsRankCard />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Тип:</span>
                  {["ALL", "INCOME", "EXPENSE"].map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={filterType === t ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setFilterType(t)}
                    >
                      {t === "ALL" ? "Все" : t === "INCOME" ? "Приход" : "Расход"}
                    </Button>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Месяц:</span>
                  <Select
                    value={filterMonth}
                    onValueChange={(v) => v != null && setFilterMonth(v)}
                    items={monthOptions.map((m) => ({ value: m.value, label: m.label }))}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Партнёр:</span>
                  <Select value={filterPartner} onValueChange={(v) => v != null && setFilterPartner(v)}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue>
                        {filterPartner === "ALL"
                          ? "Все"
                          : filterPartner === "1"
                            ? "Лёша"
                            : filterPartner === "2"
                              ? "Гена"
                              : "—"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      <SelectItem value="1">Лёша</SelectItem>
                      <SelectItem value="2">Гена</SelectItem>
                      <SelectItem value="3">—</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Проект:</span>
                  <Select
                    value={filterProject}
                    onValueChange={(v) => v != null && setFilterProject(v)}
                    items={[
                      { value: "ALL", label: "Все" },
                      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
                    ]}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Категория:</span>
                  <Select
                    value={filterCategory}
                    onValueChange={(v) => v != null && setFilterCategory(v)}
                    items={[
                      { value: "ALL", label: "Все" },
                      ...usedCategories.map((c) => ({ value: c, label: c })),
                    ]}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      {usedCategories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
      {/* Transaction Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Журнал транзакций ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Дата</TableHead>
                  <TableHead className="text-xs">Тип</TableHead>
                  <TableHead className="text-xs">Описание</TableHead>
                  <TableHead className="text-xs text-right">Сумма</TableHead>
                  <TableHead className="text-xs">Партнёр</TableHead>
                  <TableHead className="text-xs">Проект</TableHead>
                  <TableHead className="text-xs">Категория</TableHead>
                  <TableHead className="text-xs text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Нет транзакций
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        {new Date(t.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.type === "INCOME" ? "default" : t.type === "DEBT_SETTLEMENT" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {t.type === "INCOME" ? "Приход" : t.type === "DEBT_SETTLEMENT" ? "Расчёт" : "Расход"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell
                        className={`text-xs text-right font-medium ${
                          t.type === "INCOME"
                            ? "text-emerald-600"
                            : t.type === "DEBT_SETTLEMENT"
                              ? "text-muted-foreground"
                              : "text-red-600"
                        }`}
                      >
                        {t.type === "INCOME" ? "+" : t.type === "DEBT_SETTLEMENT" ? "" : "-"}
                        {formatMoney(Number(t.amount))}
                      </TableCell>
                      <TableCell className="text-xs">{t.paidBy.name}</TableCell>
                      <TableCell className="text-xs">{t.project?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{t.category}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expense Templates */}
      <ExpenseTemplates
        onUseTemplate={handleUseTemplate}
        onQuickAdd={handleQuickAdd}
        projects={projects}
        onRefresh={() => {
          fetchTransactions();
          fetchBalance();
          fetchCategories();
        }}
      />

      {/* Dialogs */}
    </FernPage>
      <AddTransactionDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setPrefillData(null);
        }}
        initialType={addDialogType}
        projects={projects}
        prefill={prefillData}
        onSuccess={() => {
          fetchTransactions();
          fetchBalance();
          fetchCategories();
          setPrefillData(null);
        }}
      />

      {editTransaction && (
        <EditTransactionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          transaction={editTransaction}
          projects={projects}
          onSuccess={() => {
            fetchTransactions();
            fetchBalance();
            fetchCategories();
          }}
        />
      )}

      {deleteTransaction && (
              <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                transaction={deleteTransaction}
                onSuccess={() => {
                  fetchTransactions();
                  fetchBalance();
                }}
              />
            )}

            <CreateInvoiceDialog
                          open={createInvoiceOpen}
                          onOpenChange={setCreateInvoiceOpen}
                          projects={projects}
                          onSuccess={() => {
                            setCreateInvoiceOpen(false);
                            fetchPendingInvoices();
                          }}
                        />

                        {manageInvoice && (
                          <InvoiceDetailDialog
                            invoice={manageInvoice}
                            open={!!manageInvoice}
                            onOpenChange={(open) => {
                              if (!open) setManageInvoice(null);
                            }}
                            onSuccess={() => {
                              setManageInvoice(null);
                              fetchPendingInvoices();
                              fetchTransactions();
                              fetchBalance();
                            }}
                          />
                        )}
    </>
  );
}