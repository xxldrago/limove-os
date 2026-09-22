"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DomainDialog } from "./domain-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { expiryInfo, EXPIRY_EMOJI, EXPIRY_CLASSES } from "./expiry";
import type { DomainRecord, ProjectData } from "./types";

interface Props {
  project: ProjectData;
  onProjectUpdate: (patch: Partial<ProjectData>) => void;
}

export function DomainsTab({ project, onProjectUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DomainRecord | null>(null);
  const [deleting, setDeleting] = useState<DomainRecord | null>(null);
  const slug = project.slug;

  async function handleDelete() {
    if (!deleting) return;
    await fetch(`/api/projects/${slug}/domains/${deleting.id}`, { method: "DELETE" });
    onProjectUpdate({ domains: project.domains.filter((d) => d.id !== deleting.id) });
    setDeleting(null);
  }

  return (
    <div className="card">
      <div className="card-head-row mb-4">
        <span className="card-title">Домены и подписки</span>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="icon-xs" /> Добавить
        </Button>
      </div>

      {project.domains.length === 0 ? (
        <p className="empty-state">Доменов и подписок пока нет</p>
      ) : (
        <div className="card card-flush" style={{ background: "transparent", border: 0, boxShadow: "none", padding: 0 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Значение</TableHead>
                <TableHead>Истекает</TableHead>
                <TableHead>Напомнить за</TableHead>
                <TableHead>Заметки</TableHead>
                <TableHead className="number-cell">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.domains.map((d) => {
                const exp = expiryInfo(d.expiresAt, d.reminderDays);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="cell-strong">{d.name}</TableCell>
                    <TableCell>{d.value}</TableCell>
                    <TableCell>
                      <span className={EXPIRY_CLASSES[exp.level]}>
                        {EXPIRY_EMOJI[exp.level]}{" "}
                        {new Date(d.expiresAt).toLocaleDateString("ru-RU")} (
                        {exp.label})
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.reminderDays > 0 ? `за ${d.reminderDays} дн.` : "—"}
                    </TableCell>
                    <TableCell className="table-cell-desc">{d.notes || "—"}</TableCell>
                    <TableCell className="number-cell">
                      <span className="cell-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(d);
                            setDialogOpen(true);
                          }}
                          aria-label="Редактировать"
                        >
                          <Pencil className="icon-xs" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(d)}
                          aria-label="Удалить"
                        >
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
        <DomainDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          domain={editing}
          slug={slug}
          onSuccess={(d) => {
            if (editing) {
              onProjectUpdate({
                domains: project.domains.map((x) => (x.id === d.id ? d : x)),
              });
            } else {
              onProjectUpdate({ domains: [...project.domains, d] });
            }
          }}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Удалить запись?"
          description={`Удалить "${deleting.name} (${deleting.value})"?`}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
