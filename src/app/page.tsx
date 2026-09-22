import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { FinancialGoalCard } from "@/components/finance/financial-goal-card";
import { FernDashboard } from "@/components/fern/fern-dashboard";
import { getTrafficDropFlags } from "@/lib/analytics-report";

async function loadData() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [projectCount, projects, transactions, incomeAgg, expenseAgg, monthIncomeAgg, monthExpenseAgg, catGroups, invoices, domainRecords, siteMonitors] =
    await Promise.all([
      prisma.project.count(),
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        include: { transactions: true },
      }),
      prisma.transaction.findMany({
        orderBy: { date: "desc" },
        take: 10,
        include: { project: true, paidBy: true },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "INCOME" },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "EXPENSE" },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "INCOME", date: { gte: monthStart } },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "EXPENSE", date: { gte: monthStart } },
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { type: "EXPENSE" },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 6,
      }),
      prisma.invoice.findMany({
        where: { status: { in: ["PENDING", "PAID"] } },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          status: true,
          receiptFile: true,
        },
      }),
      prisma.domainRecord.findMany({
        select: {
          id: true,
          name: true,
          value: true,
          expiresAt: true,
          project: { select: { slug: true } },
        },
      }),
      prisma.siteMonitor.findMany({
        where: { isActive: true, isError: true },
        select: {
          id: true,
          name: true,
          url: true,
          project: { select: { slug: true } },
        },
      }),
    ]);

  const totalIncome = Number(incomeAgg._sum.amount ?? 0);
  const totalExpenses = Number(expenseAgg._sum.amount ?? 0);
  const profit = totalIncome - totalExpenses;
  const monthIncome = Number(monthIncomeAgg._sum.amount ?? 0);
  const monthExpenses = Number(monthExpenseAgg._sum.amount ?? 0);

  return {
    session,
    projectCount,
    projects,
    transactions,
    totalIncome,
    totalExpenses,
    profit,
    monthIncome,
    monthExpenses,
    catGroups: catGroups.map((g) => ({
      category: g.category,
      spent: Number(g._sum.amount ?? 0),
      txCount: g._count._all,
    })),
    invoices,
    domainRecords,
    siteMonitors,
    trafficDrop: await getTrafficDropFlags(),
  };
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function projectMoney(project: {
  transactions: { type: string; amount: { toNumber: () => number } }[];
}) {
  let income = 0;
  let expenses = 0;
  for (const t of project.transactions) {
    if (t.type === "INCOME") income += t.amount.toNumber();
    else expenses += t.amount.toNumber();
  }
  return { income, expenses, profit: income - expenses };
}

export default async function DashboardPage() {
  const data = await loadData();

  // Build actionable "to-do" items for the dashboard.
  const todoItems: {
    key: string;
    text: string;
    href: string;
    severity: "warning" | "critical";
  }[] = [];

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const inv of data.invoices) {
    const label = inv.invoiceNumber ?? `#${inv.id}`;
    if (inv.status === "PENDING") {
      todoItems.push({
        key: `inv-pending-${inv.id}`,
        text: `Ожидает оплаты счёт ${label} на ${formatMoney(Number(inv.amount))}`,
        href: "/invoices",
        severity: "warning",
      });
    } else if (inv.status === "PAID" && !inv.receiptFile) {
      todoItems.push({
        key: `inv-receipt-${inv.id}`,
        text: `Нет чека у счёта ${label} на ${formatMoney(Number(inv.amount))}`,
        href: "/invoices",
        severity: "warning",
      });
    }
  }

  for (const dom of data.domainRecords) {
    const daysUntil = Math.floor(
      (new Date(dom.expiresAt).getTime() - now) / dayMs
    );
    const domainName = dom.value || dom.name;
    if (daysUntil < 0) {
      todoItems.push({
        key: `dom-expired-${dom.id}`,
        text: `Домен ${domainName} истёк`,
        href: "/projects",
        severity: "critical",
      });
    } else if (daysUntil <= 30) {
      todoItems.push({
        key: `dom-expiring-${dom.id}`,
        text: `Домен ${domainName} истекает через ${daysUntil} дн.`,
        href: "/projects",
        severity: "warning",
      });
    }
  }

  for (const site of data.siteMonitors) {
    const name = site.url || site.name;
    todoItems.push({
      key: `site-down-${site.id}`,
      text: `Сайт ${name} не работает`,
      href: "/monitoring",
      severity: "critical",
    });
  }

  for (const f of data.trafficDrop) {
    todoItems.push({
      key: `traffic-drop-${f.slug}`,
      text: `Падение трафика: ${f.projectName} −${f.dropPct}%`,
      href: `/projects/${f.slug}`,
      severity: "warning",
    });
  }

  const pendingBills = data.invoices.filter((i) => i.status === "PENDING");
  const pendingBillsTotal = pendingBills.reduce((s, i) => s + Number(i.amount), 0);
  const leftThisMonth = data.monthIncome - data.monthExpenses - pendingBillsTotal;
  const spentBase = data.monthIncome > 0 ? data.monthIncome : data.monthExpenses + pendingBillsTotal;
  const spentPct = spentBase > 0 ? Math.round(((data.monthExpenses + pendingBillsTotal) / spentBase) * 100) : 0;

  const monthLabel = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());

  const topCats = data.catGroups.slice(0, 3).map((g) => ({
    name: g.category,
    txCount: g.txCount,
    spent: g.spent,
    sharePct: data.totalExpenses > 0 ? Math.round((g.spent / data.totalExpenses) * 1000) / 10 : 0,
  }));

  const quietProjects = data.projects
    .map((p) => ({ p, m: projectMoney(p) }))
    .filter(({ m }) => m.income + m.expenses === 0)
    .slice(0, 2)
    .map(({ p }) => ({
      id: p.id,
      name: p.name,
      detail: "Нет операций — запланировать первую",
    }));

  return (
    <AppShell
      userName={data.session.user.name ?? undefined}
      userEmail={data.session.user.email ?? undefined}
    >
      <FernDashboard
        monthLabel={monthLabel}
        buckets={[
          { id: "income", label: "Доход", amount: data.monthIncome, sub: `за месяц · всего ${formatMoney(data.totalIncome)}`, tone: "pos" },
          { id: "bills", label: "Счета", amount: -pendingBillsTotal, sub: `${pendingBills.length} ждут оплаты`, tone: "neg" },
          { id: "planned", label: "Плановые траты", amount: -data.monthExpenses, sub: `за месяц · всего ${formatMoney(data.totalExpenses)}`, tone: "active" },
          { id: "goals", label: "Цели", amount: data.profit, sub: "накопления · доход минус расходы", tone: data.profit >= 0 ? "pos" : "neg" },
        ]}
        activeBucketId="planned"
        leftThisMonth={leftThisMonth}
        spentPct={spentPct}
        categories={topCats}
        unbudgeted={quietProjects}
        plannedTotal={data.monthExpenses}
      />

      <div className="grid-2-wide">
        <div>
          <h2 className="section-title">Последние операции</h2>
          <div className="card card-flush">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="number-cell">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="num">
                      {new Date(t.date).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="cell-strong">{t.description}</TableCell>
                    <TableCell>{t.project?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="fern-chip">{t.category}</span>
                    </TableCell>
                    <TableCell className={`number-cell cell-strong ${t.type === "INCOME" ? "text-pos" : ""}`}>
                      {t.type === "INCOME" ? "+" : "−"}
                      {formatMoney(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="stack">
          <div>
            <h2 className="section-title">Цель года</h2>
            <FinancialGoalCard />
          </div>
          {todoItems.length > 0 && (
            <div>
              <h2 className="section-title">Что нужно сделать · {todoItems.length}</h2>
              <div className="card">
                <ul className="todo-list">
                  {todoItems.slice(0, 6).map((item) => (
                    <li key={item.key} className="todo-item">
                      <a href={item.href} className="todo-link">
                        <span>{item.text}</span>
                        <Badge variant={item.severity === "critical" ? "destructive" : "secondary"}>
                          {item.severity === "critical" ? "срочно" : "внимание"}
                        </Badge>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}