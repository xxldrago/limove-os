"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { TaskDialog } from "./task-dialog";
import type { Task, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

const COLUMNS = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "REVIEW", label: "Review" },
  { key: "DONE", label: "Done" },
];

const PRIORITY_EMOJI: Record<string, string> = {
  URGENT: "🔴",
  HIGH: "🟡",
  MEDIUM: "🟢",
  LOW: "⚪",
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Срочно",
  HIGH: "Высокий",
  MEDIUM: "Средний",
  LOW: "Низкий",
};

const PRIORITY_CLASSES: Record<string, string> = {
  URGENT: "bg-[rgba(248,113,113,0.1)] text-[#F87171] dark:text-[#F87171]",
  HIGH: "bg-[rgba(251,191,36,0.1)] text-[#FBBF24] dark:text-[#FBBF24]",
  MEDIUM: "bg-[rgba(52,211,153,0.1)] text-[#34D399] dark:text-[#34D399]",
  LOW: "bg-muted text-muted-foreground",
};

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function TasksTab({ project, onProjectUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [columnForAdd, setColumnForAdd] = useState<string>("BACKLOG");
  const dragItem = useRef<Task | null>(null);
  const dragOverColumn = useRef<string | null>(null);
  const slug = project.slug;

  const tasksByColumn = (col: string) =>
    project.tasks.filter((t) => t.status === col);

  async function moveTask(task: Task, newStatus: string) {
    // Optimistic update ordering: append at end of target column
    const targetTasks = project.tasks.filter((t) => t.status === newStatus);
    const newSortOrder = targetTasks.length;

    // Optimistic
    onProjectUpdate({
      tasks: project.tasks.map((t) =>
        t.id === task.id ? { ...t, status: newStatus, sortOrder: newSortOrder } : t
      ),
    });

    try {
      await fetch(`/api/projects/${slug}/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, sortOrder: newSortOrder }),
      });
    } catch {
      // revert on failure
      onProjectUpdate({
        tasks: project.tasks.map((t) =>
          t.id === task.id ? { ...t, status: task.status, sortOrder: task.sortOrder } : t
        ),
      });
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Задачи</h3>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const tasks = tasksByColumn(col.key);
          return (
            <div
              key={col.key}
              className="w-64 shrink-0 rounded-xl border bg-muted/30 p-2"
              onDragOver={(e) => {
                e.preventDefault();
                dragOverColumn.current = col.key;
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragItem.current && dragOverColumn.current) {
                  moveTask(dragItem.current, dragOverColumn.current);
                }
                dragItem.current = null;
                dragOverColumn.current = null;
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {tasks.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setEditing(null);
                    setColumnForAdd(col.key);
                    setDialogOpen(true);
                  }}
                  aria-label={`Добавить задачу в ${col.label}`}
                >
                  <Plus />
                </Button>
              </div>

              <div className="space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => {
                      dragItem.current = t;
                    }}
                    onDragEnd={() => {
                      dragItem.current = null;
                      dragOverColumn.current = null;
                    }}
                    onClick={() => {
                      setEditing(t);
                      setDialogOpen(true);
                    }}
                    className="cursor-pointer rounded-lg border bg-background p-2.5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-1 flex items-start justify-between gap-1">
                      <span className="text-sm font-medium leading-tight">
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className={PRIORITY_CLASSES[t.priority]}>
                        {PRIORITY_EMOJI[t.priority]} {PRIORITY_LABELS[t.priority] ?? t.priority}
                      </Badge>
                    </div>
                    {(t.assigneeId || t.dueDate) && (
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        {t.assigneeId ? (
                          <span>👤 {t.assigneeId === 1 ? "Лёша" : "Гена"}</span>
                        ) : (
                          <span />
                        )}
                        {t.dueDate && (
                          <span className={t.dueDate < new Date().toISOString() ? "text-[#F87171]" : ""}>
                            📅 {formatDate(t.dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Пусто
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dialogOpen && (
        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          task={editing}
          slug={slug}
          defaultStatus={columnForAdd}
          onSuccess={(t) => {
            if (editing) {
              onProjectUpdate({
                tasks: project.tasks.map((x) => (x.id === t.id ? t : x)),
              });
            } else {
              onProjectUpdate({ tasks: [...project.tasks, t] });
            }
          }}
          onDelete={(id) => {
            onProjectUpdate({ tasks: project.tasks.filter((x) => x.id !== id) });
          }}
        />
      )}
    </div>
  );
}
