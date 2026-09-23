"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="card">
      <div className="card-head-row card-head-spaced">
        <span className="card-title">Файлы</span>
      </div>

      <div
        className={`dropzone${dragOver ? " is-over" : ""}`}
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
        <input ref={inputRef} type="file" style={{ display: "none" }} onChange={onInputChange} />
        <Upload className="dropzone-icon" />
        <p className="page-sub">
          {uploading ? "Загрузка..." : "Перетащите файл сюда или нажмите, чтобы выбрать"}
        </p>
      </div>

      {project.files.length === 0 ? (
        <p className="empty-state">Файлов пока нет</p>
      ) : (
        <div className="files-grid">
          {project.files.map((f) => (
            <div key={f.id} className="file-item">
              <FileText className="file-icon" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mini-item-title">{f.fileName}</div>
                <div className="hint">
                  {formatSize(f.fileSize)} · {new Date(f.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <span className="unbudget-actions">
                <a href={f.filePath} target="_blank" rel="noreferrer" download className="round-btn round-btn--success" aria-label="Скачать">
                  <Download className="icon-xs" />
                </a>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(f)} aria-label="Удалить">
                  <Trash2 className="icon-xs" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Удалить файл?"
          description={`Удалить файл "${deleting.fileName}"?`}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}
