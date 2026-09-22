"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FernPage } from "@/components/fern/fern-page";
import { CreateInvoiceDialog } from "@/components/finance/create-invoice-dialog";

interface ProjectSummary {
  id: number;
  slug: string;
  name: string;
  status: string;
  income: number;
  expenses: number;
  profit: number;
  credentialsCount: number;
  domainsCount: number;
  tasksCount: number;
  domainWarning: "none" | "yellow" | "red";
  expiring: {
    id: number;
    name: string;
    value: string;
    expiresAt: string;
    daysLeft: number;
    level: "yellow" | "red";
  } | null;
  siteStatus: "UP" | "DOWN" | "UNKNOWN";
}

const SITE_STATUS_LABELS: Record<string, string> = {
  UP: "🟢 UP",
  DOWN: "🔴 DOWN",
  UNKNOWN: "⚪ UNKNOWN",
};

const SITE_STATUS_CLASSES: Record<string, string> = {
  UP: "bg-green-500/15 text-green-700 dark:text-green-400",
  DOWN: "bg-red-500/15 text-red-700 dark:text-red-400",
  UNKNOWN: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  PAUSED: "На паузе",
  ARCHIVED: "Архив",
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400",
  PAUSED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceProjectId, setInvoiceProjectId] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
    <FernPage
      title="Проекты"
      total={projects.length > 0 ? `${projects.filter((p) => p.status === "ACTIVE").length} активны` : undefined}
    >

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Проектов пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.slug}`}>
              <Card className="h-full transition-all hover:-translate-y-[1px] hover:border-[#d8e0e9] hover:shadow-[0_1px_2px_rgba(15,23,32,0.05),0_14px_28px_-18px_rgba(15,23,32,0.35)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={STATUS_CLASSES[p.status]}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      <Badge variant="outline" className={SITE_STATUS_CLASSES[p.siteStatus]}>
                        {SITE_STATUS_LABELS[p.siteStatus] ?? p.siteStatus}
                      </Badge>
                      {p.expiring && (
                        <Badge
                          className={
                            p.expiring.level === "red"
                              ? "bg-red-500 text-white"
                              : "bg-yellow-500 text-white"
                          }
                          title={`${p.expiring.name} ${p.expiring.value} — ${p.expiring.level === "red" ? "истёк" : "истекает"} ${formatDate(p.expiring.expiresAt)}`}
                        >
                          {p.expiring.name} {p.expiring.level === "red" ? "истёк" : `истекает ${formatDate(p.expiring.expiresAt)}`}
                        </Badge>
                      )}
                      {!p.expiring && p.domainWarning === "red" && (
                        <Badge className="bg-red-500 text-white">Истёк срок</Badge>
                      )}
                      {!p.expiring && p.domainWarning === "yellow" && (
                        <Badge className="bg-yellow-500 text-white">Скоро истекает</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Доход</div>
                      <div className="font-semibold whitespace-nowrap text-green-600">{formatMoney(p.income)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Расход</div>
                      <div className="font-semibold whitespace-nowrap text-red-600">{formatMoney(p.expenses)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Профит</div>
                      <div className={`font-semibold whitespace-nowrap ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatMoney(p.profit)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>🔑 {p.credentialsCount}</span>
                    <span>🌐 {p.domainsCount}</span>
                    <span>📋 {p.tasksCount}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-primary hover:text-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInvoiceProjectId(p.id);
                      setInvoiceDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Счёт
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <CreateInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open);
          if (!open) setInvoiceProjectId(undefined);
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        initialProjectId={invoiceProjectId}
        onSuccess={() => {
          setInvoiceDialogOpen(false);
          setInvoiceProjectId(undefined);
          load();
        }}
      />
    </FernPage>
    </>
  );
}
