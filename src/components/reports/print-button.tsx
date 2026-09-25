"use client";

import { Printer, FileSpreadsheet } from "lucide-react";

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

/** Кнопка «Скачать Excel» — выгрузка отчёта проекта в .xlsx. */
export function ReportExcelButton({ href }: { href: string }) {
  return (
    <a href={href} className="btn btn-secondary print-hidden">
      <FileSpreadsheet className="icon-xs" />
      Скачать Excel
    </a>
  );
}