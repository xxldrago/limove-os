"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Zap, CreditCard } from "lucide-react";
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
          <Button onClick={() => handleAddClick("INCOME")} className="h-10 rounded-[12px] bg-[#34D399] px-[18px] text-[#090D14] hover:bg-[#177245]">
            <Plus className="mr-2 h-4 w-4" /> Приход
          </Button>
          <Button onClick={() => handleAddClick("EXPENSE")} className="h-10 rounded-[12px] bg-[#10B981] px-[18px] text-[#090D14] hover:bg-[#059669]">
            <Plus className="mr-2 h-4 w-4" /> Расход
          </Button>
          <Button onClick={() => setCreateInvoiceOpen(true)} variant="outline" className="h-10 rounded-[12px] px-[18px]">
            <FileText className="mr-2 h-4 w-4" /> Счёт
          </Button>
        </>
      }
    >

      {/* Сводка за месяц — Fernbrook-стиль: белые плоские карточки, tabular-цифры */}
      {balance && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-[#94A3B8]">Приход за месяц</div>
              <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#34D399]">
                +{formatMoney(balance.totalIncome).replace("−", "")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-[#94A3B8]">Расход за месяц</div>
              <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#F87171]">
                −{formatMoney(balance.totalExpenses).replace("−", "")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-[#94A3B8]">Прибыль</div>
              <div className={`num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap ${balance.profit >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
                {balance.profit >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(balance.profit))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-[#94A3B8]">Лёша потратил</div>
              <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#F87171]">
                {formatMoney(balance.partners.lesha.spent)}
              </div>
              <div className="mt-3 border-t border-[#1E2638] pt-3">
                <div className="text-xs text-[#94A3B8]">Лёша получил</div>
                <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#34D399]">
                  {formatMoney(balance.partners.lesha.received)}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-[#94A3B8]">Гена потратил</div>
              <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#F87171]">
                {formatMoney(balance.partners.gena.spent)}
              </div>
              <div className="mt-3 border-t border-[#1E2638] pt-3">
                <div className="text-xs text-[#94A3B8]">Гена получил</div>
                <div className="num mt-1 text-[20px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#34D399]">
                  {formatMoney(balance.partners.gena.received)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Баланс партнёров + ожидающие счета — в одной строке */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {balance && <PartnerBalanceCard balance={balance} onSettled={fetchBalance} />}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Ожидают оплаты
            </CardTitle>
            <span className="num text-sm text-[#94A3B8]">{pendingInvoices.count} сч.</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="num text-[28px] font-bold tracking-[-0.03em] whitespace-nowrap text-[#34D399]">
              {formatMoney(pendingInvoices.sum)}
            </div>
            {pendingInvoiceList.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">Нет неоплаченных счетов</p>
            ) : (
              <ul className="space-y-2">
                {pendingInvoiceList.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-[#1E2638] px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#F8FAFC]">
                        {inv.invoiceNumber ?? `INV-${String(inv.id).padStart(4, "0")}`} · {inv.project?.name ?? "—"}
                      </div>
                      <div className="num text-sm font-semibold text-[#94A3B8]">{formatMoney(Number(inv.amount))}</div>
                    </div>
                    <Button size="sm" className="h-8 rounded-[10px] bg-[#10B981] text-[#090D14] hover:bg-[#059669]" onClick={() => setManageInvoice(inv)}>
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
                            ? "text-[#34D399]"
                            : t.type === "DEBT_SETTLEMENT"
                              ? "text-muted-foreground"
                              : "text-[#F87171]"
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