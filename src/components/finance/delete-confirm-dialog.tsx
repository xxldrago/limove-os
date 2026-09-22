"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Transaction {
  id: number;
  description: string;
  amount: string;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onSuccess: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: DeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError("Ошибка удаления");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Удалить транзакцию?</DialogTitle>
          <DialogDescription>
            «{transaction.description}» на сумму {transaction.amount} ₽ будет
            удалена без возможности восстановления.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="text-neg">{error}</div>}

        <div className="form-actions form-actions--end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? <Loader2 className="icon-xs" /> : null}
            Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}