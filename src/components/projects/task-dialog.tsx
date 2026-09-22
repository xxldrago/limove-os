"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { Task } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  slug: string;
  defaultStatus: string;
  onSuccess: (t: Task) => void;
  onDelete: (id: number) => void;
}

const PRIORITIES = [
  { value: "LOW", label: "Низкий" },
  { value: "MEDIUM", label: "Средний" },
  { value: "HIGH", label: "Высокий" },
  { value: "URGENT", label: "Срочно" },
];

const STATUSES = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  slug,
  defaultStatus,
  onSuccess,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(task?.status ?? defaultStatus);
  const [assignee, setAssignee] = useState(
    task ? String(task.assigneeId ?? "") : ""
  );
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  const isEdit = !!task;

  async function submit() {
    setSaving(true);
    try {
      const body = {
        title,
        description,
        priority,
        status,
        assigneeId: assignee ? Number(assignee) : null,
        dueDate: dueDate || null,
      };
      const res = await fetch(
        `/api/projects/${slug}/tasks${isEdit ? `/${task.id}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        const data = await res.json();
        onSuccess(data);
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!task) return;
    await fetch(`/api/projects/${slug}/tasks/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать задачу" : "Новая задача"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Название</Label>
            <Input
              className="col-span-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Описание</Label>
            <Textarea
              className="col-span-3 min-h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Приоритет</Label>
            <Select
              value={priority}
              onValueChange={(v) => v && setPriority(v)}
              items={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            >
              <SelectTrigger className="col-span-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Статус</Label>
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v)}
              items={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            >
              <SelectTrigger className="col-span-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Исполнитель</Label>
            <Select
              value={assignee}
              onValueChange={(v) => v !== null && setAssignee(v)}
              items={[
                { value: "", label: "Не назначен" },
                { value: "1", label: "Лёша" },
                { value: "2", label: "Гена" },
              ]}
            >
              <SelectTrigger className="col-span-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не назначен</SelectItem>
                <SelectItem value="1">Лёша</SelectItem>
                <SelectItem value="2">Гена</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Срок</Label>
            <Input
              className="col-span-3"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          <div>
            {isEdit && (
              <Button variant="destructive" size="icon" onClick={doDelete} aria-label="Удалить задачу">
                <Trash2 />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={saving || !title}>
              {isEdit ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
