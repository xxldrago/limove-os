"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FernPage } from "@/components/fern/fern-page";
import { ElementxDialog } from "@/components/elementx/elementx-dialog";
import { DeleteConfirmDialog } from "@/components/elementx/delete-confirm-dialog";

interface ExUser {
  id: number;
  fullName: string;
  login: string;
  registerDate: string;
  paidDate: string | null;
  company: string | null;
  status: string;
  notes: string | null;
}

const STATUS_META: Record<string, { label: string; emoji: string; cls: string }> = {
  PAID: { label: "PAID", emoji: "🟢", cls: "badge-success" },
  TRIAL: { label: "TRIAL", emoji: "🟡", cls: "badge-warn" },
  READY_UNPAID: { label: "READY_UNPAID", emoji: "🟠", cls: "badge-warn" },
  NOT_INSTALLED: { label: "NOT_INSTALLED", emoji: "🔴", cls: "badge-danger" },
  EXPIRED: { label: "EXPIRED", emoji: "⚫", cls: "badge-neutral" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, emoji: "⚪", cls: "badge-neutral" };
  return (
    <span className={`badge ${m.cls}`}>
      {m.emoji} {m.label}
    </span>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ElementxPageClient() {
  const [users, setUsers] = useState<ExUser[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [company, setCompany] = useState("ALL");
  const [sort, setSort] = useState("id");
  const [companies, setCompanies] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExUser | null>(null);
  const [deleting, setDeleting] = useState<ExUser | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (searchInput) q.set("search", searchInput);
    if (company !== "ALL") q.set("company", company);
    q.set("sort", sort);
    const res = await fetch(`/api/elementx?${q.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
      setCompanies(Array.from(new Set<string>(data.map((u: ExUser) => u.company).filter(Boolean) as string[])));
    }
  }, [searchInput, company, sort]);

  useEffect(() => {
    load();
  }, [load]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchInput(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleDelete() {
    if (!deleting) return;
    await fetch(`/api/elementx/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  return (
    <>
    <FernPage
      title="ElementX Пользователи"
      total={users.length > 0 ? `${users.length} чел` : undefined}
      tools={
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="btn-tall">
          <Plus className="icon-xs" /> Добавить
        </Button>
      }
    >

      <div className="filter-bar">
        <Input
          className="select-search"
          placeholder="Поиск по имени/логину..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={company}
          onValueChange={(v) => { if (v != null) setCompany(v); }}
          items={[{ value: "ALL", label: "Все компании" }, ...companies.map((c) => ({ value: c, label: c }))]}
        >
          <SelectTrigger className="select-md">
            <SelectValue placeholder="Компания" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все компании</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => { if (v != null) setSort(v); }}
          items={[
            { value: "id", label: "По добавлению" },
            { value: "registerDate", label: "По дате регистрации" },
            { value: "paidDate", label: "По дате оплаты" },
          ]}
        >
          <SelectTrigger className="select-md">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">По добавлению</SelectItem>
            <SelectItem value="registerDate">По дате регистрации</SelectItem>
            <SelectItem value="paidDate">По дате оплаты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card">
        <div className="list-card-head">
          <span className="card-title">Список пользователей ({users.length})</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Пользователь</TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>Дата регистрации</TableHead>
              <TableHead>Дата оплаты</TableHead>
              <TableHead>Компания</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="number-cell">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="empty-row">
                  Нет пользователей
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="hint">{u.id}</TableCell>
                  <TableCell className="cell-strong">{u.fullName}</TableCell>
                  <TableCell className="num">{u.login}</TableCell>
                  <TableCell>{formatDate(u.registerDate)}</TableCell>
                  <TableCell>{formatDate(u.paidDate)}</TableCell>
                  <TableCell>{u.company || "—"}</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell className="number-cell">
                    <span className="cell-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditing(u); setDialogOpen(true); }}
                        aria-label="Редактировать"
                      >
                        <Pencil className="icon-xs" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(u)}
                        aria-label="Удалить"
                      >
                        <Trash2 className="icon-xs icon-danger" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </FernPage>

      <ElementxDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        onSuccess={() => { setDialogOpen(false); setEditing(null); load(); }}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Удалить пользователя"
        description={`Удалить пользователя ${deleting?.fullName} (${deleting?.login})?`}
        onConfirm={handleDelete}
      />
    </>
  );
}
