"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "@/components/finance/add-transaction-dialog";
import { CreateInvoiceDialog } from "@/components/finance/create-invoice-dialog";
import { PartnerBalanceCard } from "@/components/finance/partner-balance-card";

interface DashboardProject {
  id: number;
  name: string;
  slug: string;
}

/** Кнопки «Приход / Расход / Счёт» + диалоги. После сохранения обновляет страницу. */
export function DashboardActions({ projects }: { projects: DashboardProject[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const openAdd = (type: "INCOME" | "EXPENSE") => {
    setAddType(type);
    setAddOpen(true);
  };

  const refresh = () => router.refresh();

  return (
    <>
      <div className="page-tools">
        <Button onClick={() => openAdd("INCOME")}>
          <Plus className="icon-xs" /> Приход
        </Button>
        <Button onClick={() => openAdd("EXPENSE")}>
          <Plus className="icon-xs" /> Расход
        </Button>
        <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
          <FileText className="icon-xs" /> Счёт
        </Button>
      </div>

      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        initialType={addType}
        projects={projects}
        onSuccess={() => {
          setAddOpen(false);
          refresh();
        }}
      />
      <CreateInvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        projects={projects}
        onSuccess={() => {
          setInvoiceOpen(false);
          refresh();
        }}
      />
    </>
  );
}

/** Баланс партнёров за месяц (подтягивается через API). */
export function DashboardBalance({ month }: { month: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [balance, setBalance] = useState<any | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/balance?month=${month}`);
      if (res.ok) setBalance(await res.json());
    } catch {
      // ignore — карточка просто не покажется
    }
  }, [month]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (!balance) return null;
  return <PartnerBalanceCard balance={balance} onSettled={fetchBalance} />;
}
