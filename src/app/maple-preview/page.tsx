import { AppShell } from "@/components/app-shell";
import { MapleDashboard } from "@/components/maple/maple-dashboard";

export default function MaplePreviewPage() {
  return (
    <AppShell userName="Маркус" userEmail="preview@limove.ru">
      <MapleDashboard
        userName="Маркус"
        projects={[
          { id: "1", name: "Limove.ru", description: "Главный сайт", status: "ACTIVE", income: 1250000, expenses: 420000, profit: 830000 },
          { id: "2", name: "Стройка", description: "Ремонт", status: "ACTIVE", income: 640000, expenses: 310000, profit: 330000 },
          { id: "3", name: "VPN-сервис", description: "Подписки", status: "ACTIVE", income: 180000, expenses: 60000, profit: 120000 },
          { id: "4", name: "Консалтинг", description: "Аудит", status: "PAUSED", income: 90000, expenses: 120000, profit: -30000 },
          { id: "5", name: "Маркет", description: "Пилот", status: "ACTIVE", income: 210000, expenses: 95000, profit: 115000 },
          { id: "6", name: "Архив", description: "2024", status: "DONE", income: 500000, expenses: 380000, profit: 120000 },
        ]}
        todos={[
          { key: "t1", text: "Ожидает оплаты счёт №12 на 45 000 ₽", href: "/invoices", severity: "warning" },
          { key: "t2", text: "Домен limove.ru истекает через 12 дн.", href: "/projects", severity: "warning" },
          { key: "t3", text: "Сайт example.ru не работает", href: "/monitoring", severity: "critical" },
        ]}
        totalIncome={2770000}
        totalExpenses={1365000}
        profit={1405000}
        pendingInvoices={2}
        clockTemp="19:42"
      />
    </AppShell>
  );
}
