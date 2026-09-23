"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, EyeOff, Copy, Pencil, Trash2 } from "lucide-react";
import { CredentialDialog } from "./credential-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { expiryInfo, EXPIRY_EMOJI, EXPIRY_CLASSES } from "./expiry";
import type { Credential, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

function makeUrl(maybe: string | null): string {
  if (!maybe) return "";
  if (/^https?:\/\//i.test(maybe)) return maybe;
  return "https://" + maybe;
}

export function CredentialsTab({ project, onProjectUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [revealed, setRevealed] = useState<Record<number, { password: string; timer: number }>>({});
  const [copied, setCopied] = useState<Record<number, boolean>>({});

  const slug = project.slug;

  function refresh(updated: Credential) {
    const list = project.credentials.map((c) => (c.id === updated.id ? updated : c));
    onProjectUpdate({ credentials: list });
  }

  async function handleCopy(c: Credential) {
    try {
      const res = await fetch(`/api/projects/${slug}/credentials/${c.id}/decrypt`);
      if (!res.ok) return;
      const data = await res.json();
      await navigator.clipboard.writeText(data.password);
      setCopied((prev) => ({ ...prev, [c.id]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [c.id]: false })), 1500);
    } catch {
      // ignore
    }
  }

  async function handleShow(c: Credential) {
    if (revealed[c.id]) {
      window.clearTimeout(revealed[c.id].timer);
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/projects/${slug}/credentials/${c.id}/decrypt`);
      if (!res.ok) return;
      const data = await res.json();
      const timer = window.setTimeout(() => {
        setRevealed((prev) => {
          const next = { ...prev };
          delete next[c.id];
          return next;
        });
      }, 5000);
      setRevealed((prev) => ({ ...prev, [c.id]: { password: data.password, timer } }));
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    await fetch(`/api/projects/${slug}/credentials/${deleting.id}`, { method: "DELETE" });
    onProjectUpdate({
      credentials: project.credentials.filter((c) => c.id !== deleting.id),
    });
    setDeleting(null);
  }

  return (
    <div className="card">
      <div className="card-head-row card-head-spaced">
        <span className="card-title">Доступы</span>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="icon-xs" /> Добавить
        </Button>
      </div>

      {project.credentials.length === 0 ? (
        <p className="empty-state">Доступов пока нет</p>
      ) : (
        <div className="card card-flush" style={{ background: "transparent", border: 0, boxShadow: "none", padding: 0 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сервис</TableHead>
                <TableHead>Логин</TableHead>
                <TableHead>Пароль</TableHead>
                <TableHead>Ссылка</TableHead>
                <TableHead>Истекает</TableHead>
                <TableHead>Заметки</TableHead>
                <TableHead className="number-cell">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.credentials.map((c) => {
                const exp = expiryInfo(c.expiresAt);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="cell-strong">{c.serviceName}</TableCell>
                    <TableCell>{c.login || "—"}</TableCell>
                    <TableCell className="num">
                      {revealed[c.id] ? revealed[c.id].password : "••••••••"}
                      <span className="cell-actions" style={{ display: "inline-flex", marginLeft: 4 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleShow(c)}
                          aria-label="Показать пароль"
                        >
                          {revealed[c.id] ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(c)} aria-label="Скопировать">
                          <Copy className="icon-xs" />
                        </Button>
                        {copied[c.id] && <span className="text-pos">✓</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {c.url ? (
                        <a href={makeUrl(c.url)} target="_blank" rel="noreferrer" className="link">
                          {c.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={EXPIRY_CLASSES[exp.level]}>
                        {EXPIRY_EMOJI[exp.level]} {exp.label}
                      </span>
                    </TableCell>
                    <TableCell className="table-cell-desc">{c.notes || "—"}</TableCell>
                    <TableCell className="number-cell">
                      <span className="cell-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                          aria-label="Редактировать"
                        >
                          <Pencil className="icon-xs" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label="Удалить">
                          <Trash2 className="icon-xs" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogOpen && (
        <CredentialDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          credential={editing}
          slug={slug}
          onSuccess={(cred) => {
            if (editing) refresh(cred);
            else onProjectUpdate({ credentials: [...project.credentials, cred] });
          }}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Удалить доступ?"
          description={`Удалить доступ "${deleting.serviceName}"?`}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
