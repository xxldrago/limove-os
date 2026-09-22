"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid gap-4 md:grid-cols-2">
      {/* Notes list */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Заметки</h3>
            <Button
              onClick={() => openNote(null, true)}
            >
              <Plus /> Новая
            </Button>
          </div>
          <div className="space-y-2">
            {project.notes.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Заметок пока нет
              </p>
            )}
            {project.notes.map((n) => (
              <div
                key={n.id}
                className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
                  selected?.id === n.id ? "border-primary bg-accent" : ""
                }`}
                onClick={() => openNote(n)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">
                    {n.pinned ? "📌 " : ""}
                    {n.title}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(n);
                      }}
                      aria-label={n.pinned ? "Открепить" : "Закрепить"}
                    >
                      {n.pinned ? <PinOff /> : <Pin />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#F87171]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(n);
                      }}
                      aria-label="Удалить"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {preview(n.content)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card>
        <CardContent className="pt-6">
          {creating || selected ? (
            <div className="space-y-3">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Название заметки"
              />
              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Содержимое (Markdown)..."
                className="min-h-64"
              />
              <div className="flex justify-end gap-2">
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
            <p className="py-12 text-center text-sm text-muted-foreground">
              Выберите заметку или создайте новую
            </p>
          )}
        </CardContent>
      </Card>

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
