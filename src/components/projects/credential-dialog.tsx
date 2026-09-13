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
import type { Credential } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  credential: Credential | null;
  slug: string;
  onSuccess: (c: Credential) => void;
}

export function CredentialDialog({ open, onOpenChange, credential, slug, onSuccess }: Props) {
  const [serviceName, setServiceName] = useState(credential?.serviceName ?? "");
  const [login, setLogin] = useState(credential?.login ?? "");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState(credential?.url ?? "");
  const [expiresAt, setExpiresAt] = useState(
    credential?.expiresAt ? credential.expiresAt.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(credential?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!credential;

  async function submit() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        serviceName,
        login,
        url,
        expiresAt: expiresAt || null,
        notes,
      };
      // On edit, only re-encrypt if password provided
      if (password) body.password = password;

      const res = await fetch(
        `/api/projects/${slug}/credentials${isEdit ? `/${credential.id}` : ""}`,
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
          <DialogTitle>{isEdit ? "Редактировать доступ" : "Новый доступ"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Сервис</Label>
            <Input
              className="col-span-3"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="WordPress"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Логин</Label>
            <Input
              className="col-span-3"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Пароль</Label>
            <Input
              className="col-span-3"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "(оставьте пустым, чтобы не менять)" : ""}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Ссылка</Label>
            <Input
              className="col-span-3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com"
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
          <Button onClick={submit} disabled={saving || !serviceName}>
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
