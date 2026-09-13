"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Домены и подписки</h3>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Добавить
          </Button>
        </div>

        {project.domains.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Доменов и подписок пока нет
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Значение</TableHead>
                <TableHead>Истекает</TableHead>
                <TableHead>Напомнить за</TableHead>
                <TableHead>Заметки</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.domains.map((d) => {
                const exp = expiryInfo(d.expiresAt, d.reminderDays);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
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
                    <TableCell className="max-w-40 truncate">{d.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditing(d);
                            setDialogOpen(true);
                          }}
                          aria-label="Редактировать"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-600"
                          onClick={() => setDeleting(d)}
                          aria-label="Удалить"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

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
    </Card>
  );
}
