"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PAID: { label: "PAID", emoji: "🟢", cls: "text-[#34D399] bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.2)]" },
  TRIAL: { label: "TRIAL", emoji: "🟡", cls: "text-[#FBBF24] bg-[rgba(251,191,36,0.1)] border-yellow-200" },
  READY_UNPAID: { label: "READY_UNPAID", emoji: "🟠", cls: "text-[#FBBF24] bg-orange-50 border-orange-200" },
  NOT_INSTALLED: { label: "NOT_INSTALLED", emoji: "🔴", cls: "text-[#F87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]" },
  EXPIRED: { label: "EXPIRED", emoji: "⚫", cls: "text-foreground bg-muted border-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, emoji: "⚪", cls: "text-muted-foreground bg-muted border-muted" };
  return (
    <Badge variant="outline" className={m.cls}>
      {m.emoji} {m.label}
    </Badge>
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
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="h-10 rounded-[12px] px-[18px]">
          <Plus className="mr-1 h-4 w-4" /> Добавить
        </Button>
      }
    >

      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="Поиск по имени/логину..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={company}
          onValueChange={(v) => { if (v != null) setCompany(v); }}
          items={[{ value: "ALL", label: "Все компании" }, ...companies.map((c) => ({ value: c, label: c }))]}
        >
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">По добавлению</SelectItem>
            <SelectItem value="registerDate">По дате регистрации</SelectItem>
            <SelectItem value="paidDate">По дате оплаты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Список пользователей ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Логин</TableHead>
                <TableHead>Дата регистрации</TableHead>
                <TableHead>Дата оплаты</TableHead>
                <TableHead>Компания</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Нет пользователей
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-muted-foreground">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{u.login}</TableCell>
                    <TableCell>{formatDate(u.registerDate)}</TableCell>
                    <TableCell>{formatDate(u.paidDate)}</TableCell>
                    <TableCell>{u.company || "—"}</TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditing(u); setDialogOpen(true); }}
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(u)}
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4 text-[#F87171]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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