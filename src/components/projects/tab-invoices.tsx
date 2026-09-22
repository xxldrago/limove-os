"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvoiceRecord, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return <span className="badge badge-warn">🟡 Ожидает</span>;
    case "PAID":
      return <span className="badge badge-success">🟢 Оплачен</span>;
    case "CANCELLED":
      return <span className="badge badge-neutral">⚫ Обнулён</span>;
    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
}

export function InvoicesTab({ project }: Props) {
  const invoices: InvoiceRecord[] = project.invoices ?? [];

  const pendingSum = invoices
    .filter((i) => i.status === "PENDING")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const paidSum = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="tab-inner">
      <div className="grid-3">
        <div className="card">
          <div className="stat-label">Всего счетов</div>
          <div className="stat-value">{invoices.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Ожидают оплаты</div>
          <div className="stat-value" style={{ color: "#FBBF24" }}>{formatMoney(pendingSum)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Оплачено</div>
          <div className="stat-value stat-value--pos">{formatMoney(paidSum)}</div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="card">
          <div className="empty-state">По этому проекту счетов нет</div>
        </div>
      ) : (
        <div className="card card-flush">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Номер</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead className="number-cell">Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата создания</TableHead>
                <TableHead>Дата оплаты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="num">{inv.id}</TableCell>
                  <TableCell className="num">{inv.invoiceNumber ?? "—"}</TableCell>
                  <TableCell className="cell-strong">{inv.description}</TableCell>
                  <TableCell className="number-cell">{formatMoney(Number(inv.amount))}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="num">{formatDate(inv.createdAt)}</TableCell>
                  <TableCell className="num">{formatDate(inv.paidDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
