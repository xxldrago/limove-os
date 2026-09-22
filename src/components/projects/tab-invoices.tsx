"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      return (
        <Badge variant="outline" className="border-[rgba(251,191,36,0.4)] text-[#FBBF24] bg-[rgba(251,191,36,0.1)]">
          🟡 Ожидает
        </Badge>
      );
    case "PAID":
      return (
        <Badge variant="outline" className="border-[#34D399] text-[#34D399] bg-[rgba(52,211,153,0.1)]">
          🟢 Оплачен
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="border-[#263147] text-[#94A3B8] bg-[#131926]">
          ⚫ Обнулён
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
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
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Всего счетов</div>
            <div className="text-lg font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ожидают оплаты</div>
            <div className="text-lg font-bold text-[#FBBF24]">{formatMoney(pendingSum)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Оплачено</div>
            <div className="text-lg font-bold text-[#34D399]">{formatMoney(paidSum)}</div>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            По этому проекту счетов нет
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">№</TableHead>
                  <TableHead>Номер</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead>Дата оплаты</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-muted-foreground">{inv.id}</TableCell>
                    <TableCell className="font-mono">{inv.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">{inv.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(Number(inv.amount))}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.paidDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}