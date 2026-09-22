"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  UP: "badge-success",
  DOWN: "badge-danger",
  UNKNOWN: "badge-neutral",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  PAUSED: "На паузе",
  ARCHIVED: "Архив",
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "badge-success",
  PAUSED: "badge-warn",
  ARCHIVED: "badge-neutral",
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
      <div className="project-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 192 }} />
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
        <div className="card">
          <div className="empty-state">Проектов пока нет</div>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.slug}`} className="card project-card">
              <div className="project-head">
                <span className="project-name">{p.name}</span>
                <span className="project-badges">
                  <span className={`badge ${STATUS_CLASSES[p.status] ?? "badge-neutral"}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span className={`badge ${SITE_STATUS_CLASSES[p.siteStatus] ?? "badge-neutral"}`}>
                    {SITE_STATUS_LABELS[p.siteStatus] ?? p.siteStatus}
                  </span>
                  {p.expiring && (
                    <span
                      className={`badge ${p.expiring.level === "red" ? "badge-solid-danger" : "badge-solid-warn"}`}
                      title={`${p.expiring.name} ${p.expiring.value} — ${p.expiring.level === "red" ? "истёк" : "истекает"} ${formatDate(p.expiring.expiresAt)}`}
                    >
                      {p.expiring.name} {p.expiring.level === "red" ? "истёк" : `истекает ${formatDate(p.expiring.expiresAt)}`}
                    </span>
                  )}
                  {!p.expiring && p.domainWarning === "red" && (
                    <span className="badge badge-solid-danger">Истёк срок</span>
                  )}
                  {!p.expiring && p.domainWarning === "yellow" && (
                    <span className="badge badge-solid-warn">Скоро истекает</span>
                  )}
                </span>
              </div>

              <div className="project-fin">
                <div>
                  <div className="project-fin-label">Доход</div>
                  <div className="project-fin-value text-pos">{formatMoney(p.income)}</div>
                </div>
                <div>
                  <div className="project-fin-label">Расход</div>
                  <div className="project-fin-value text-neg">{formatMoney(p.expenses)}</div>
                </div>
                <div>
                  <div className="project-fin-label">Профит</div>
                  <div className={`project-fin-value ${p.profit >= 0 ? "text-pos" : "text-neg"}`}>
                    {formatMoney(p.profit)}
                  </div>
                </div>
              </div>

              <div className="project-counts">
                <span>🔑 {p.credentialsCount}</span>
                <span>🌐 {p.domainsCount}</span>
                <span>📋 {p.tasksCount}</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="btn-block"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setInvoiceProjectId(p.id);
                  setInvoiceDialogOpen(true);
                }}
              >
                <Plus className="icon-xs" />
                Счёт
              </Button>
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
