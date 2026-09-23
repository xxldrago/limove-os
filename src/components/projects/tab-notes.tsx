"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import type { Note, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

export function NotesTab({ project, onProjectUpdate }: Props) {
  const [selected, setSelected] = useState<Note | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const slug = project.slug;

  function openNote(n: Note | null, isNew = false) {
    setSelected(n);
    setEditingTitle(n?.title ?? "");
    setEditingContent(n?.content ?? "");
    setCreating(isNew);
  }

  function preview(content: string) {
    return content.replace(/#{1,6}\s*/g, "").slice(0, 60) || "Без содержимого";
  }

  async function save() {
    if (!selected) return;
    const res = await fetch(`/api/projects/${slug}/notes/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editingTitle || "Заметка",
        content: editingContent,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onProjectUpdate({
        notes: project.notes.map((n) => (n.id === data.id ? data : n)),
      });
      setSelected(null);
    }
  }

  async function create() {
    const res = await fetch(`/api/projects/${slug}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editingTitle || "Заметка",
        content: editingContent,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onProjectUpdate({ notes: [...project.notes, data] });
      setSelected(null);
      setCreating(false);
    }
  }

  async function togglePin(n: Note) {
    const res = await fetch(`/api/projects/${slug}/notes/${n.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !n.pinned }),
    });
    if (res.ok) {
      const data = await res.json();
      onProjectUpdate({
        notes: project.notes.map((x) => (x.id === data.id ? data : x)),
      });
    }
  }

  async function doDelete() {
    if (!deleting) return;
    await fetch(`/api/projects/${slug}/notes/${deleting.id}`, { method: "DELETE" });
    onProjectUpdate({ notes: project.notes.filter((n) => n.id !== deleting.id) });
    if (selected?.id === deleting.id) setSelected(null);
    setDeleting(null);
  }

  return (
    <div className="grid-2">
      {/* Список заметок */}
      <div className="card">
        <div className="card-head-row card-head-spaced">
          <span className="card-title">Заметки</span>
          <Button onClick={() => openNote(null, true)}>
            <Plus className="icon-xs" /> Новая
          </Button>
        </div>
        <div className="stack-sm">
          {project.notes.length === 0 && <p className="empty-state">Заметок пока нет</p>}
          {project.notes.map((n) => (
            <div
              key={n.id}
              className={`note-item${selected?.id === n.id ? " is-active" : ""}`}
              onClick={() => openNote(n)}
            >
              <div className="card-head-row">
                <div className="mini-item-title" style={{ flex: 1 }}>
                  {n.pinned ? "📌 " : ""}
                  {n.title}
                </div>
                <span className="cell-actions" style={{ flexShrink: 0 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(n);
                    }}
                    aria-label={n.pinned ? "Открепить" : "Закрепить"}
                  >
                    {n.pinned ? <PinOff className="icon-xs" /> : <Pin className="icon-xs" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(n);
                    }}
                    aria-label="Удалить"
                  >
                    <Trash2 className="icon-xs" />
                  </Button>
                </span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>{preview(n.content)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Редактор */}
      <div className="card">
        {creating || selected ? (
          <div className="stack-sm">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Название заметки"
            />
            <Textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="Содержимое (Markdown)..."
            />
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  setCreating(false);
                }}
              >
                Отмена
              </Button>
              {creating ? (
                <Button onClick={create} disabled={!editingTitle.trim()}>
                  Создать
                </Button>
              ) : (
                <Button onClick={save}>Сохранить</Button>
              )}
            </div>
          </div>
        ) : (
          <p className="empty-state">Выберите заметку или создайте новую</p>
        )}
      </div>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Удалить заметку?"
          description={`Удалить заметку "${deleting.title}"?`}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}
