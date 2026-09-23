"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Zap, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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


  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchTransactions();
    fetchBalance();
  }, [fetchTransactions, fetchBalance]);

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
          }
    } catch {
      // ignore
    }
  };

  const monthOptions = getMonthOptions();
  const usedCategories = [...new Set([...categories, ...transactions.map((t) => t.category)])];

  return (
    <>
    <FernPage
      title="Финансы"
      sub={balance ? `Прибыль за месяц: ${formatMoney(balance.profit)}` : "Доходы, расходы и счета"}
      total={balance ? formatMoney(balance.totalIncome) : undefined}
      tools={
        <>
          <Button onClick={() => handleAddClick("INCOME")}>
            <Plus className="icon-xs" /> Приход
          </Button>
          <Button onClick={() => handleAddClick("EXPENSE")}>
            <Plus className="icon-xs" /> Расход
          </Button>
          <Button onClick={() => setCreateInvoiceOpen(true)} variant="outline">
            <FileText className="icon-xs" /> Счёт
          </Button>
        </>
      }
    >
      {/* Сводка за месяц */}
      {balance && (
        <div className="grid-stats">
          <div className="card">
            <div className="stat-label">Приход за месяц</div>
            <div className="stat-value stat-value--pos">
              +{formatMoney(balance.totalIncome).replace("−", "")}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Расход за месяц</div>
            <div className="stat-value stat-value--neg">
              −{formatMoney(balance.totalExpenses).replace("−", "")}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Прибыль</div>
            <div className={`stat-value ${balance.profit >= 0 ? "stat-value--pos" : "stat-value--neg"}`}>
              {balance.profit >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(balance.profit))}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Лёша потратил</div>
            <div className="stat-value stat-value--neg">{formatMoney(balance.partners.lesha.spent)}</div>
            <div className="stat-sub">
              <div className="stat-label">Лёша получил</div>
              <div className="stat-value stat-value--pos">{formatMoney(balance.partners.lesha.received)}</div>
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Гена потратил</div>
            <div className="stat-value stat-value--neg">{formatMoney(balance.partners.gena.spent)}</div>
            <div className="stat-sub">
              <div className="stat-label">Гена получил</div>
              <div className="stat-value stat-value--pos">{formatMoney(balance.partners.gena.received)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Баланс партнёров + ожидающие счета — в одной строке */}
      <div className="grid-2">
        {balance && <PartnerBalanceCard balance={balance} onSettled={fetchBalance} />}

        <div className="card">
          <div className="card-head-row mb-3">
            <div className="card-title-row">
              <FileText className="icon-xs" />
              <span className="card-title">Ожидают оплаты</span>
            </div>
            <span className="page-total">{pendingInvoices.count} сч.</span>
          </div>
          <div className="stat-value stat-value--pos">{formatMoney(pendingInvoices.sum)}</div>
          {pendingInvoiceList.length === 0 ? (
            <p className="page-sub">Нет неоплаченных счетов</p>
          ) : (
            <ul className="pending-list mt-3">
              {pendingInvoiceList.map((inv) => (
                <li key={inv.id} className="pending-item">
                  <div style={{ minWidth: 0 }}>
                    <div className="pending-name">
                      {inv.invoiceNumber ?? `INV-${String(inv.id).padStart(4, "0")}`} · {inv.project?.name ?? "—"}
                    </div>
                    <div className="pending-sum">{formatMoney(Number(inv.amount))}</div>
                  </div>
                  <Button size="sm" onClick={() => setManageInvoice(inv)}>
                    <CreditCard className="icon-xs" /> Оплатить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Цель, прогноз и маржинальность — в одной строке */}
      <div className="grid-3">
        <FinancialGoalCard />
        <ForecastCard />
        <MarginsRankCard />
      </div>

      {/* Фильтры */}
      <div className="card">
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Тип</span>
            {["ALL", "INCOME", "EXPENSE"].map((t) => (
              <Button
                key={t}
                size="sm"
                variant={filterType === t ? "default" : "outline"}
                onClick={() => setFilterType(t)}
              >
                {t === "ALL" ? "Все" : t === "INCOME" ? "Приход" : "Расход"}
              </Button>
            ))}
          </div>

          <span className="filter-sep" />

          <div className="filter-group">
            <span className="filter-label">Месяц</span>
            <Select
              value={filterMonth}
              onValueChange={(v) => v != null && setFilterMonth(v)}
              items={monthOptions.map((m) => ({ value: m.value, label: m.label }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="filter-sep" />

          <div className="filter-group">
            <span className="filter-label">Партнёр</span>
            <Select value={filterPartner} onValueChange={(v) => v != null && setFilterPartner(v)}>
              <SelectTrigger>
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

          <div className="filter-group">
            <span className="filter-label">Проект</span>
            <Select
              value={filterProject}
              onValueChange={(v) => v != null && setFilterProject(v)}
              items={[
                { value: "ALL", label: "Все" },
                ...projects.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            >
              <SelectTrigger>
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

          <div className="filter-group">
            <span className="filter-label">Категория</span>
            <Select
              value={filterCategory}
              onValueChange={(v) => v != null && setFilterCategory(v)}
              items={[
                { value: "ALL", label: "Все" },
                ...usedCategories.map((c) => ({ value: c, label: c })),
              ]}
            >
              <SelectTrigger>
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
      </div>

      {/* Журнал транзакций */}
      <div className="card card-flush">
        <div className="card-head-row" style={{ padding: "20px 24px 12px" }}>
          <span className="card-title">Журнал транзакций ({transactions.length})</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="number-cell">Сумма</TableHead>
              <TableHead>Партнёр</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="number-cell">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="empty-row">
                  Нет транзакций
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="num">
                    {new Date(t.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.type === "INCOME" ? "default" : t.type === "DEBT_SETTLEMENT" ? "secondary" : "destructive"}
                    >
                      {t.type === "INCOME" ? "Приход" : t.type === "DEBT_SETTLEMENT" ? "Расчёт" : "Расход"}
                    </Badge>
                  </TableCell>
                  <TableCell className="cell-strong cell-desc">{t.description}</TableCell>
                  <TableCell
                    className={`number-cell ${
                      t.type === "INCOME"
                        ? "text-pos"
                        : t.type === "DEBT_SETTLEMENT"
                          ? ""
                          : "text-neg"
                    }`}
                  >
                    {t.type === "INCOME" ? "+" : t.type === "DEBT_SETTLEMENT" ? "" : "−"}
                    {formatMoney(Number(t.amount))}
                  </TableCell>
                  <TableCell>{t.paidBy.name}</TableCell>
                  <TableCell>{t.project?.name ?? "—"}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell className="number-cell">
                    <span className="cell-actions">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                        <Pencil className="icon-xs" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}>
                        <Trash2 className="icon-xs" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Шаблоны расходов */}
      <ExpenseTemplates
        onUseTemplate={handleUseTemplate}
        onQuickAdd={handleQuickAdd}
        projects={projects}
        onRefresh={() => {
          fetchTransactions();
          fetchBalance();
        }}
      />
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
