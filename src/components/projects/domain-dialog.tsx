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
import type { DomainRecord } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  domain: DomainRecord | null;
  slug: string;
  onSuccess: (d: DomainRecord) => void;
}

export function DomainDialog({ open, onOpenChange, domain, slug, onSuccess }: Props) {
  const [name, setName] = useState(domain?.name ?? "");
  const [value, setValue] = useState(domain?.value ?? "");
  const [expiresAt, setExpiresAt] = useState(
    domain?.expiresAt ? domain.expiresAt.slice(0, 10) : ""
  );
  const [reminderDays, setReminderDays] = useState(
    domain ? String(domain.reminderDays) : "7"
  );
  const [notes, setNotes] = useState(domain?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!domain;

  async function submit() {
    setSaving(true);
    try {
      const body = {
        name,
        value,
        expiresAt,
        reminderDays: Number(reminderDays) || 7,
        notes,
      };
      const res = await fetch(
        `/api/projects/${slug}/domains${isEdit ? `/${domain.id}` : ""}`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать запись" : "Новая запись"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Название</Label>
            <Input
              className="col-span-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Домен / Хостинг / Тильда"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Значение</Label>
            <Input
              className="col-span-3"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="rskrsk.ru"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Истекает</Label>
            <Input
              className="col-span-3"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Напомнить за</Label>
            <Input
              className="col-span-3"
              type="number"
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Заметки</Label>
            <Input
              className="col-span-3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={saving || !name || !value || !expiresAt}>
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
