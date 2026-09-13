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
import { AddTransactionDialog } from "@/components/finance/add-transaction-dialog";
import { EditTransactionDialog } from "@/components/finance/edit-transaction-dialog";
import { DeleteConfirmDialog } from "@/components/finance/delete-confirm-dialog";
import { PartnerBalanceCard } from "@/components/finance/partner-balance-card";
import { ExpenseTemplates } from "@/components/finance/expense-templates";
import { FinancialGoalCard } from "@/components/finance/financial-goal-card";
import { MarginsCard } from "@/components/finance/margins-card";
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
  partners: {
    lesha: { name: string; share: number; spent: number; balance: number };
    gena: { name: string; share: number; spent: number; balance: number };
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-bold">Финансы</h1>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button onClick={() => handleAddClick("INCOME")} className="bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" /> Добавить приход
                              </Button>
                              <Button onClick={() => handleAddClick("EXPENSE")} variant="destructive" className="sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" /> Добавить расход
                              </Button>
                              <Button onClick={() => setCreateInvoiceOpen(true)} variant="outline" className="sm:w-auto border-indigo-400 text-indigo-700 hover:bg-indigo-50">
                                <FileText className="mr-2 h-4 w-4" /> Выставить счёт
                              </Button>
                            </div>
      </div>

      {/* Monthly Summary */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Приход за месяц</div>
              <div className="text-lg font-bold text-emerald-600">{formatMoney(balance.totalIncome)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Расход за месяц</div>
              <div className="text-lg font-bold text-red-600">{formatMoney(balance.totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Прибыль</div>
              <div className={`text-lg font-bold ${balance.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatMoney(balance.profit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Лёша потратил</div>
              <div className="text-lg font-bold">{formatMoney(balance.partners.lesha.spent)}</div>
            </CardContent>
          </Card>
          <Card>
                      <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Гена потратил</div>
                        <div className="text-lg font-bold">{formatMoney(balance.partners.gena.spent)}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Pending invoices summary (amber highlight) */}
                <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Ожидают оплаты
                      </div>
                      <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                        {pendingInvoices.count} сч.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">На сумму</div>
                      <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                        {formatMoney(pendingInvoices.sum)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                                {/* Pending invoices to mark paid (operations live here in Finance) */}
                                {pendingInvoiceList.length > 0 && (
                                  <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/10">
                                    <CardContent className="p-4">
                                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                                        Счета к оплате
                                      </div>
                                      <ul className="space-y-2">
                                        {pendingInvoiceList.map((inv) => (
                                          <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium truncate">
                                                {inv.invoiceNumber ?? `INV-${String(inv.id).padStart(4, "0")}`} · {inv.project?.name ?? "—"}
                                              </div>
                                              <div className="text-xs text-muted-foreground">{formatMoney(Number(inv.amount))}</div>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => setManageInvoice(inv)}>
                                              <CreditCard className="mr-1.5 h-4 w-4" /> Оплатить
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Financial goal for the year */}
                                                <FinancialGoalCard />

                                                                {/* Margins + forecast (пункт D) */}
                                                <MarginsCard />

      {/* Filters and Partner Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
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
                  <Select value={filterMonth} onValueChange={(v) => v != null && setFilterMonth(v)}>
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все</SelectItem>
                      <SelectItem value="1">Лёша</SelectItem>
                      <SelectItem value="2">Гена</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Проект:</span>
                  <Select value={filterProject} onValueChange={(v) => v != null && setFilterProject(v)}>
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
                  <Select value={filterCategory} onValueChange={(v) => v != null && setFilterCategory(v)}>
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
        </div>

        <div className="lg:col-span-1">
          {balance && <PartnerBalanceCard balance={balance} />}
        </div>
      </div>

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
                        <Badge variant={t.type === "INCOME" ? "default" : "destructive"} className="text-xs">
                          {t.type === "INCOME" ? "Приход" : "Расход"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${t.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                        {t.type === "INCOME" ? "+" : "-"}
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
                      </div>
                    );
                  }