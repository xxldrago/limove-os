"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Zap, Play, X, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="card">
      <div className="card-head-row mb-3">
        <span className="card-title">Шаблоны расходов</span>
        <span className="cell-actions">
          <Button variant="outline" size="sm" onClick={copyLastMonth} disabled={copying} title="Скопировать расходы прошлого месяца в текущий">
            <Copy className="icon-xs" />
            {copying ? "Копирование..." : "Повторить прошлый месяц"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="icon-xs" /> Добавить
          </Button>
        </span>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="tpl-form">
          <div className="form-row">
            <Label>Название</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название шаблона"
            />
          </div>
          <div className="form-row">
            <Label>Сумма</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-row">
            <Label>Категория</Label>
            <Select
              value={newCategory}
              onValueChange={(v) => v != null && setNewCategory(v)}
              items={categories.map((c) => ({ value: c, label: c }))}
            >
              <SelectTrigger>
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
          <div className="cell-actions">
            <Button type="submit" size="sm">
              <Check className="icon-xs" /> Сохранить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resetAddForm}>
              <X className="icon-xs" />
            </Button>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="empty-state">Нет шаблонов. Добавьте первый шаблон.</div>
      ) : (
        <div className="tpl-grid">
          {templates.map((t) => (
            <div key={t.id} className="tpl-card">
              {editingId === t.id ? (
                <div className="stack-sm">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <div className="form-grid-2">
                    <Input
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
                      <SelectTrigger>
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
                  <div className="cell-actions">
                    <Button size="sm" onClick={() => handleEditSave(t)}>
                      <Check className="icon-xs" /> Сохранить
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="icon-xs" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="card-head-row">
                    <div className="tpl-name">{t.name}</div>
                    <span className="cell-actions">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(t)} aria-label="Редактировать">
                        <Pencil className="icon-xs" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} aria-label="Удалить">
                        <Trash2 className="icon-xs icon-danger" />
                      </Button>
                    </span>
                  </div>
                  <div className="tpl-meta">
                    <span className="num cell-strong">{Number(t.amount)} ₽</span>
                    <span className="badge badge-neutral">{t.category}</span>
                  </div>
                  <div className="tpl-actions">
                    <Button size="sm" variant="outline" onClick={() => onUseTemplate(t)}>
                      <Play className="icon-xs" /> Использовать
                    </Button>
                    <Button size="sm" onClick={() => onQuickAdd(t)}>
                      <Zap className="icon-xs" /> Добавить сейчас
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
