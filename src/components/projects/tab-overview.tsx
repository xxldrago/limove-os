"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X } from "lucide-react";
import type { ProjectData } from "./types";
import { STATUS_LABELS, EXPECTED_STATUSES } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

const TASK_STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export function OverviewTab({ project, onProjectUpdate }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [descDraft, setDescDraft] = useState(project.description ?? "");

  async function saveName() {
    const res = await fetch(`/api/projects/${project.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft }),
    });
    if (res.ok) {
      onProjectUpdate({ name: nameDraft });
      setEditingName(false);
    }
  }

  async function saveDesc() {
    const res = await fetch(`/api/projects/${project.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descDraft }),
    });
    if (res.ok) {
      onProjectUpdate({ description: descDraft });
      setEditingDesc(false);
    }
  }

  async function saveStatus(value: string) {
    const res = await fetch(`/api/projects/${project.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value }),
    });
    if (res.ok) {
      onProjectUpdate({ status: value });
    }
  }

  const statCards = [
    { label: "Доход", value: formatMoney(project.totalIncome), color: "text-green-600" },
    { label: "Расходы", value: formatMoney(project.totalExpenses), color: "text-red-600" },
    {
      label: "Профит",
      value: formatMoney(project.profit),
      color: project.profit >= 0 ? "text-green-600" : "text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Name & description */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-2">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                <Button size="icon" onClick={saveName} aria-label="Сохранить">
                  <Check />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingName(false)} aria-label="Отмена">
                  <X />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <h2 className="text-xl font-semibold">{project.name}</h2>
                <Button size="icon" variant="ghost" onClick={() => setEditingName(true)} aria-label="Редактировать">
                  <Pencil />
                </Button>
              </div>
            )}
            <Select value={project.status} onValueChange={(v) => v && saveStatus(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPECTED_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            {editingDesc ? (
              <div className="flex items-start gap-2">
                <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} className="min-h-20" />
                <Button size="icon" onClick={saveDesc} aria-label="Сохранить">
                  <Check />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingDesc(false)} aria-label="Отмена">
                  <X />
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {project.description || "Нет описания"}
                </p>
                <Button size="icon" variant="ghost" onClick={() => setEditingDesc(true)} aria-label="Редактировать">
                  <Pencil />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent notes, recent files, task summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Последние заметки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.notes.slice(0, 3).map((n) => (
              <div key={n.id} className="rounded-lg border p-2">
                <div className="text-sm font-medium truncate">
                  {n.pinned ? "📌 " : ""}{n.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {n.content || "Без содержимого"}
                </div>
              </div>
            ))}
            {project.notes.length === 0 && (
              <p className="text-sm text-muted-foreground">Нет заметок</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Последние файлы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.files.slice(0, 3).map((f) => (
              <div key={f.id} className="rounded-lg border p-2">
                <div className="text-sm font-medium truncate">{f.fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {(f.fileSize / 1024).toFixed(1)} KB ·{" "}
                  {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
            ))}
            {project.files.length === 0 && (
              <p className="text-sm text-muted-foreground">Нет файлов</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Задачи по статусам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <Badge variant="outline">
                  {project.taskCounts[key as keyof typeof project.taskCounts] ?? 0}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
