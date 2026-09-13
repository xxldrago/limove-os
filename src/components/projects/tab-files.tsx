"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Trash2, FileText, Upload } from "lucide-react";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import type { ProjectFile, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FilesTab({ project, onProjectUpdate }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<ProjectFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slug = project.slug;

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${slug}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onProjectUpdate({ files: [data, ...project.files] });
      }
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function doDelete() {
    if (!deleting) return;
    await fetch(`/api/projects/${slug}/files/${deleting.id}`, { method: "DELETE" });
    onProjectUpdate({ files: project.files.filter((f) => f.id !== deleting.id) });
    setDeleting(null);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Файлы</h3>
        </div>

        {/* Upload area */}
        <div
          className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-accent/40" : "border-border"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={onInputChange}
          />
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {uploading
              ? "Загрузка..."
              : "Перетащите файл сюда или нажмите, чтобы выбрать"}
          </p>
        </div>

        {/* Files grid */}
        {project.files.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Файлов пока нет
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.files.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSize(f.fileSize)} ·{" "}
                    {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={f.filePath}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600"
                    onClick={() => setDeleting(f)}
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Удалить файл?"
          description={`Удалить файл "${deleting.fileName}"?`}
          onConfirm={doDelete}
        />
      )}
    </Card>
  );
}
