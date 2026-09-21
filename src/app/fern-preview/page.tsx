import { AppShell } from "@/components/app-shell";
import { FernDashboard } from "@/components/fern/fern-dashboard";

export default function FernPreviewPage() {
  return (
    <AppShell userName="Маркус" userEmail="preview@limove.ru">
      <FernDashboard
        monthLabel="Сентябрь 2026"
        buckets={[
          { id: "income", label: "Доход", amount: 285000, sub: "за месяц · всего 2 770 000 ₽", tone: "pos" },
          { id: "bills", label: "Счета", amount: -135000, sub: "3 ждут оплаты", tone: "neg" },
          { id: "planned", label: "Плановые траты", amount: -198700, sub: "за месяц · всего 1 365 000 ₽", tone: "active" },
          { id: "goals", label: "Цели", amount: 86300, sub: "накопления · доход минус расходы", tone: "pos" },
        ]}
        activeBucketId="planned"
        leftThisMonth={-48700}
        spentPct={78}
        categories={[
          { name: "Стройматериалы", txCount: 9, spent: 412850, sharePct: 30.2 },
          { name: "Топливо и авто", txCount: 4, spent: 246000, sharePct: 18.0 },
          { name: "Продукты", txCount: 12, spent: 184000, sharePct: 13.5 },
        ]}
        unbudgeted={[
          { id: "u1", name: "Питание вне дома", detail: "Нет операций — запланировать первую" },
          { id: "u2", name: "Здоровье", detail: "Нет операций — запланировать первую" },
        ]}
        plannedTotal={198700}
      />
    </AppShell>
  );
}
