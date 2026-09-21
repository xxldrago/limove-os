"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp, TrendingDown, FileText, X } from "lucide-react";
import { AddTransactionDialog } from "@/components/finance/add-transaction-dialog";

interface Project {
  id: number;
  slug: string;
  name: string;
}

type FabAction = null | "INCOME" | "EXPENSE" | "INVOICES";

export function QuickActionsFAB() {
  const { status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [action, setAction] = useState<FabAction>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Project[]) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, [status]);

  if (status !== "authenticated") return null;

  const trigger = (a: "INCOME" | "EXPENSE" | "INVOICES") => {
    setOpen(false);
    if (a === "INVOICES") router.push("/invoices");
    else setAction(a);
  };

  return (
    <>
      {/* FAB — visible on mobile only (hidden on md+) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 md:hidden">
        {open && (
          <>
            <FabButton label="Добавить приход" onClick={() => trigger("INCOME")} icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} />
            <FabButton label="Добавить расход" onClick={() => trigger("EXPENSE")} icon={<TrendingDown className="h-5 w-5 text-red-500" />} />
            <FabButton label="Загрузить счёт" onClick={() => trigger("INVOICES")} icon={<FileText className="h-5 w-5 text-blue-500" />} />
          </>
        )}
        <button
          type="button"
          aria-label={open ? "Закрыть" : "Быстрые действия"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#16548f] text-white shadow-[0_4px_8px_rgba(15,63,109,0.22),0_18px_30px_-14px_rgba(15,63,109,0.75)] transition-transform hover:bg-[#1c68ad] active:scale-95"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* Quick action -> full AddTransactionDialog */}
      {(action === "INCOME" || action === "EXPENSE") && (
        <AddTransactionDialog
          open={!!action}
          onOpenChange={(open) => !open && setAction(null)}
          initialType={action}
          projects={projects}
          onSuccess={() => setAction(null)}
        />
      )}
    </>
  );
}

function FabButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md"
    >
      {icon}
      {label}
    </button>
  );
}