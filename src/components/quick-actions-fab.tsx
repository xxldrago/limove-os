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
      {/* FAB — только на мобильных (скрыт на md+) */}
      <div className="fab-wrap">
        {open && (
          <>
            <FabButton label="Добавить приход" onClick={() => trigger("INCOME")} icon={<TrendingUp className="fab-mini-icon text-pos" />} />
            <FabButton label="Добавить расход" onClick={() => trigger("EXPENSE")} icon={<TrendingDown className="fab-mini-icon text-neg" />} />
            <FabButton label="Загрузить счёт" onClick={() => trigger("INVOICES")} icon={<FileText className="fab-mini-icon" />} />
          </>
        )}
        <button
          type="button"
          aria-label={open ? "Закрыть" : "Быстрые действия"}
          onClick={() => setOpen((v) => !v)}
          className="fab-main"
        >
          {open ? <X className="fab-main-icon" /> : <Plus className="fab-main-icon" />}
        </button>
      </div>

      {/* Быстрое действие -> полный AddTransactionDialog */}
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
    <button type="button" onClick={onClick} className="fab-mini">
      {icon}
      {label}
    </button>
  );
}
