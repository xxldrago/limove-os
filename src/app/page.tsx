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
import { DashboardActions, DashboardBalance } from "@/components/dashboard/dashboard-widgets";
import { getTrafficDropFlags } from "@/lib/analytics-report";

async function loadData() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [projects, transactions, monthIncomeAgg, monthExpenseAgg, invoices, domainRecords, errorMonitors, monitors] =
    await Promise.all([
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      prisma.transaction.findMany({
        orderBy: { date: "desc" },
        take: 10,
        include: { project: true, paidBy: true },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "INCOME", date: { gte: monthStart } },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "EXPENSE", date: { gte: monthStart } },
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
      prisma.siteMonitor.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          url: true,
          isError: true,
          lastStatus: true,
          lastLatency: true,
        },
      }),
    ]);

  const monthIncome = Number(monthIncomeAgg._sum.amount ?? 0);
  const monthExpenses = Number(monthExpenseAgg._sum.amount ?? 0);

  return {
    session,
    monthKey,
    projects,
    transactions,
    monthIncome,
    monthExpenses,
    invoices,
    domainRecords,
    errorMonitors,
    monitors,
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

  for (const site of data.errorMonitors) {
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

  const monthProfit = data.monthIncome - data.monthExpenses;
  const pendingBills = data.invoices.filter((i) => i.status === "PENDING");
  const pendingBillsTotal = pendingBills.reduce((s, i) => s + Number(i.amount), 0);
  const monthLabel = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  const shownMonitors = data.monitors.slice(0, 6);
  const hiddenMonitors = data.monitors.length - shownMonitors.length;

  return (
    <AppShell
      userName={data.session.user.name ?? undefined}
      userEmail={data.session.user.email ?? undefined}
    >
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Дашборд</h1>
          <p className="page-sub">{monthLabel}</p>
        </div>
        <DashboardActions projects={data.projects} />
      </div>

      <div className="grid-stats">
        <div className="card">
          <div className="stat-label">Приход за месяц</div>
          <div className="stat-value stat-value--pos">+{formatMoney(data.monthIncome)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Расход за месяц</div>
          <div className="stat-value stat-value--neg">−{formatMoney(data.monthExpenses)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Чистая прибыль</div>
          <div className={`stat-value ${monthProfit >= 0 ? "stat-value--pos" : "stat-value--neg"}`}>
            {monthProfit >= 0 ? "+" : "−"}{formatMoney(Math.abs(monthProfit))}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Счета ожидают оплаты</div>
          <div className="stat-value">{pendingBills.length}</div>
          <p className="page-sub">на {formatMoney(pendingBillsTotal)}</p>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <h2 className="section-title">Финансовая цель</h2>
          <FinancialGoalCard />
        </div>
        <div>
          <h2 className="section-title">Баланс партнёров</h2>
          <DashboardBalance month={data.monthKey} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head-row mb-3">
            <span className="card-title">Мониторинг</span>
            <a href="/monitoring" className="link">Все сайты</a>
          </div>
          {data.monitors.length === 0 ? (
            <p className="page-sub">Нет сайтов для мониторинга</p>
          ) : (
            <ul className="todo-list">
              {shownMonitors.map((m) => (
                <li key={m.id} className="todo-item">
                  <a href="/monitoring" className="todo-link">
                    <span className="cell-actions">
                      <span className={`site-dot ${m.isError ? "site-dot--bad" : "site-dot--ok"}`} />
                      <span>
                        <span className="cell-strong">{m.name}</span>
                        <br />
                        <span className="hint">{(m.url || "").replace(/^https?:\/\//, "")}</span>
                      </span>
                    </span>
                    <span className="num">
                      {m.lastLatency !== null && m.lastLatency !== undefined
                        ? `${m.lastLatency} ms`
                        : m.lastStatus !== null && m.lastStatus !== undefined
                          ? `код ${m.lastStatus}`
                          : "—"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {hiddenMonitors > 0 && (
            <p className="page-sub">и ещё {hiddenMonitors}… <a href="/monitoring" className="link">открыть мониторинг</a></p>
          )}
        </div>

        <div className="card">
          <div className="card-head-row mb-3">
            <span className="card-title">Уведомления · {todoItems.length}</span>
          </div>
          {todoItems.length === 0 ? (
            <p className="page-sub">Всё спокойно 🎉</p>
          ) : (
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
          )}
        </div>
      </div>

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
    </AppShell>
  );
}
