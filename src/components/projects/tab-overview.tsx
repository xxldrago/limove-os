"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    { label: "Доход", value: formatMoney(project.totalIncome), color: "text-pos" },
    { label: "Расходы", value: formatMoney(project.totalExpenses), color: "text-neg" },
    {
      label: "Профит",
      value: formatMoney(project.profit),
      color: project.profit >= 0 ? "text-pos" : "text-neg",
    },
  ];

  return (
    <div className="stack">
      {/* Название и описание */}
      <div className="card">
        <div className="card-head-row mb-3">
          {editingName ? (
            <div className="form-actions" style={{ flex: 1 }}>
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              <Button size="icon" onClick={saveName} aria-label="Сохранить">
                <Check className="icon-xs" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingName(false)} aria-label="Отмена">
                <X className="icon-xs" />
              </Button>
            </div>
          ) : (
            <div className="form-actions" style={{ flex: 1 }}>
              <h2 className="detail-title">{project.name}</h2>
              <Button size="icon" variant="ghost" onClick={() => setEditingName(true)} aria-label="Редактировать">
                <Pencil className="icon-xs" />
              </Button>
            </div>
          )}
          <Select
            value={project.status}
            onValueChange={(v) => v && saveStatus(v)}
            items={EXPECTED_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          >
            <SelectTrigger>
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

        {editingDesc ? (
          <div className="form-actions">
            <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} />
            <Button size="icon" onClick={saveDesc} aria-label="Сохранить">
              <Check className="icon-xs" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingDesc(false)} aria-label="Отмена">
              <X className="icon-xs" />
            </Button>
          </div>
        ) : (
          <div className="form-actions">
            <p className="page-sub" style={{ flex: 1, whiteSpace: "pre-wrap" }}>
              {project.description || "Нет описания"}
            </p>
            <Button size="icon" variant="ghost" onClick={() => setEditingDesc(true)} aria-label="Редактировать">
              <Pencil className="icon-xs" />
            </Button>
          </div>
        )}
      </div>

      {/* Метрики */}
      <div className="grid-3">
        {statCards.map((s) => (
          <div key={s.label} className="card">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Заметки, файлы, задачи */}
      <div className="grid-3">
        <div className="card">
          <div className="card-title mb-3">Последние заметки</div>
          <div className="stack-sm">
            {project.notes.slice(0, 3).map((n) => (
              <div key={n.id} className="mini-item">
                <div className="mini-item-title">
                  {n.pinned ? "📌 " : ""}{n.title}
                </div>
                <div className="hint">{n.content || "Без содержимого"}</div>
              </div>
            ))}
            {project.notes.length === 0 && <p className="page-sub">Нет заметок</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-title mb-3">Последние файлы</div>
          <div className="stack-sm">
            {project.files.slice(0, 3).map((f) => (
              <div key={f.id} className="mini-item">
                <div className="mini-item-title">{f.fileName}</div>
                <div className="hint">
                  {(f.fileSize / 1024).toFixed(1)} KB ·{" "}
                  {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
            ))}
            {project.files.length === 0 && <p className="page-sub">Нет файлов</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-title mb-3">Задачи по статусам</div>
          <div className="stack-sm">
            {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="partner-row">
                <span>{label}</span>
                <b>{project.taskCounts[key as keyof typeof project.taskCounts] ?? 0}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
