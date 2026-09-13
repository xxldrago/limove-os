import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getTrafficDropFlags } from "@/lib/analytics-report";

async function loadData() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const [projectCount, projects, transactions, incomeAgg, expenseAgg, invoices, domainRecords, siteMonitors] =
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

  return {
    session,
    projectCount,
    projects,
    transactions,
    totalIncome,
    totalExpenses,
    profit,
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

  return (
    <AppShell
      userName={data.session.user.name ?? undefined}
      userEmail={data.session.user.email ?? undefined}
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>

        {/* To-do tail: actionable items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>Что нужно сделать</span>
              {todoItems.length > 0 && (
                <Badge
                  variant="outline"
                  className={
                    todoItems.some((t) => t.severity === "critical")
                      ? "bg-red-500/15 text-red-600 border-red-500/40"
                      : "bg-amber-400/20 text-amber-700 border-amber-500/40"
                  }
                >
                  {todoItems.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todoItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Все в порядке 🎉</p>
            ) : (
              <ul className="divide-y">
                {todoItems.map((item) => (
                  <li key={item.key} className="py-2 first:pt-0 last:pb-0">
                    <a
                      href={item.href}
                      className="flex items-center justify-between gap-3 text-sm hover:underline"
                    >
                      <span>{item.text}</span>
                      <Badge variant={item.severity === "critical" ? "destructive" : "secondary"}>
                        {item.severity === "critical" ? "срочно" : "внимание"}
                      </Badge>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Проектов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.projectCount}</div>
              <p className="text-xs text-muted-foreground">активных проектов</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Доход</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(data.totalIncome)}
              </div>
              <p className="text-xs text-muted-foreground">всего поступлений</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Расходы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(data.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">всего затрат</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Прибыль</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMoney(data.profit)}
              </div>
              <p className="text-xs text-muted-foreground">доход минус расходы</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial goal for the year */}
        <FinancialGoalCard />

        {/* Projects list */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Проекты</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {data.projects.map((project) => {
              const m = projectMoney(project);
              return (
                <Card key={project.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge variant="secondary">{project.status}</Badge>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Доход</span>
                      <span className="font-medium">{formatMoney(m.income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Расход</span>
                      <span className="font-medium">{formatMoney(m.expenses)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Прибыль</span>
                      <span className="font-semibold">{formatMoney(m.profit)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent transactions */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Последние операции</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Проект</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>{t.project?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={t.type === "INCOME" ? "default" : "secondary"}
                        >
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={
                          "text-right font-medium " +
                          (t.type === "INCOME" ? "text-emerald-600" : "text-red-600")
                        }
                      >
                        {t.type === "INCOME" ? "+" : "−"}
                        {formatMoney(Number(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}