"use client";

import { Printer } from "lucide-react";

/** Кнопка «Скачать/Распечатать PDF» — вызывает диалог печати браузера. */
export function ReportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-primary print-hidden"
    >
      <Printer className="icon-xs" />
      Скачать PDF
    </button>
  );
}