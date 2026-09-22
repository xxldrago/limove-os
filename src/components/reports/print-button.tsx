"use client";

import { Printer } from "lucide-react";

/** Кнопка «Скачать/Распечатать PDF» — вызывает диалог печати браузера. */
export function ReportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-medium text-[#090D14] hover:bg-[#059669] transition-colors print:hidden"
    >
      <Printer className="h-4 w-4" />
      Скачать PDF
    </button>
  );
}