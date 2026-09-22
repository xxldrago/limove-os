"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Zap, Play, X, Check, Copy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Template {
  id: number;
  name: string;
  amount: string;
  category: string;
}

const categories = [
  "Обслужка",
  "Налог",
  "Хостинг",
  "Подписка",
  "VPN",
  "Продвижение",
  "Другое",
];

interface ExpenseTemplatesProps {
  onUseTemplate: (template: { name: string; amount: string; category: string }) => void;
  onQuickAdd: (template: { name: string; amount: string; category: string }) => void;
  projects: { id: number; name: string; slug: string }[];
  onRefresh: () => void;
}

export function ExpenseTemplates({
  onUseTemplate,
  onQuickAdd,
  projects,
  onRefresh,
}: ExpenseTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Другое");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Другое");

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/finance/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const copyLastMonth = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch("/api/finance/copy-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (onRefresh) onRefresh();
        // Surface a lightweight confirmation.
        window.alert(
          data.count > 0
            ? `Скопировано расходов: ${data.count}`
            : "За прошлый месяц расходов не найдено."
        );
      } else {
        window.alert("Не удалось скопировать расходы.");
      }
    } catch {
      window.alert("Ошибка при копировании.");
    } finally {
      setCopying(false);
    }
  };

  const resetAddForm = () => {
    setNewName("");
    setNewAmount("");
    setNewCategory("Другое");
    setShowAddForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;
    const res = await fetch("/api/finance/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        amount: parseFloat(newAmount),
        category: newCategory,
      }),
    });
    if (res.ok) {
      resetAddForm();
      fetchTemplates();
    }
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditAmount(String(t.amount));
    setEditCategory(t.category);
  };

  const handleEditSave = async (t: Template) => {
    const res = await fetch(`/api/finance/templates/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        amount: parseFloat(editAmount),
        category: editCategory,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchTemplates();
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/finance/templates/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchTemplates();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Шаблоны расходов</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyLastMonth}
                    disabled={copying}
                    title="Скопировать расходы прошлого месяца в текущий"
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    {copying ? "Копирование..." : "Повторить прошлый месяц"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Добавить
                  </Button>
                </div>
              </div>
            </CardHeader>
      <CardContent>
        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-3"
          >
            <div className="space-y-1">
              <Label className="text-xs">Название</Label>
              <Input
                className="h-8 w-48 text-xs"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название шаблона"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Сумма</Label>
              <Input
                className="h-8 w-24 text-xs"
                type="number"
                step="0.01"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Категория</Label>
              <Select
                value={newCategory}
                onValueChange={(v) => v != null && setNewCategory(v)}
                items={categories.map((c) => ({ value: c, label: c }))}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <Button type="submit" size="sm" className="h-8">
                <Check className="mr-1 h-3.5 w-3.5" /> Сохранить
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={resetAddForm}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        )}

        {/* Templates grid */}
        {templates.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Нет шаблонов. Добавьте первый шаблон.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <Input
                      className="h-8 text-xs"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        className="h-8 w-24 text-xs"
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                      <Select
                        value={editCategory}
                        onValueChange={(v) => v != null && setEditCategory(v)}
                        items={categories.map((c) => ({ value: c, label: c }))}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleEditSave(t)}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => startEdit(t)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="font-semibold">{Number(t.amount)} ₽</span>
                      <Badge variant="secondary" className="text-xs">
                        {t.category}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={() => onUseTemplate(t)}
                      >
                        <Play className="mr-1 h-3 w-3" /> Использовать
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-[#10B981] hover:bg-[#059669]"
                        onClick={() => onQuickAdd(t)}
                      >
                        <Zap className="mr-1 h-3 w-3" /> Добавить сейчас
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}