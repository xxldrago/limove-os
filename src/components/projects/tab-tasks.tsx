"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
  URGENT: "badge-danger",
  HIGH: "badge-warn",
  MEDIUM: "badge-success",
  LOW: "badge-neutral",
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
    <div className="tab-inner">
      <h3 className="section-title">Задачи</h3>

      <div className="kanban">
        {COLUMNS.map((col) => {
          const tasks = tasksByColumn(col.key);
          return (
            <div
              key={col.key}
              className="kanban-col"
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
              <div className="kanban-head">
                <div className="card-title-row">
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="badge badge-neutral">{tasks.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(null);
                    setColumnForAdd(col.key);
                    setDialogOpen(true);
                  }}
                  aria-label={`Добавить задачу в ${col.label}`}
                >
                  <Plus className="icon-xs" />
                </Button>
              </div>

              <div className="stack-sm">
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
                    className="kanban-card"
                  >
                    <span className="kanban-card-title">{t.title}</span>
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${PRIORITY_CLASSES[t.priority] ?? "badge-neutral"}`}>
                        {PRIORITY_EMOJI[t.priority]} {PRIORITY_LABELS[t.priority] ?? t.priority}
                      </span>
                    </div>
                    {(t.assigneeId || t.dueDate) && (
                      <div className="kanban-meta">
                        {t.assigneeId ? (
                          <span>👤 {t.assigneeId === 1 ? "Лёша" : "Гена"}</span>
                        ) : (
                          <span />
                        )}
                        {t.dueDate && (
                          <span className={t.dueDate < new Date().toISOString() ? "text-neg" : ""}>
                            📅 {formatDate(t.dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && <div className="kanban-empty">Пусто</div>}
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
