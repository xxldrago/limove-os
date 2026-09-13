"use client";

import { Printer } from "lucide-react";

/** Кнопка «Скачать/Распечатать PDF» — вызывает диалог печати браузера. */
export function ReportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors print:hidden"
    >
      <Printer className="h-4 w-4" />
      Скачать PDF
    </button>
  );
}