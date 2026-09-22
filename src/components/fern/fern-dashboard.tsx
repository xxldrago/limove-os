"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Minus,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  CircleHelp,
  EllipsisVertical,
  ArrowLeftRight,
  History,
} from "lucide-react";

export type FernBucket = {
  id: string;
  label: string;
  amount: number;
  sub: string;
  tone: "pos" | "neg" | "active";
};

export type FernCategory = {
  name: string;
  txCount: number;
  spent: number;
  sharePct: number;
};

export type FernProject = {
  id: number | string;
  name: string;
  detail: string;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function Donut({ spentPct, negative }: { spentPct: number; negative: boolean }) {
  const r = 63;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, spentPct));
  return (
    <svg
      width="168"
      height="168"
      viewBox="0 0 168 168"
      role="img"
      aria-label="Структура трат за месяц"
      className="mx-auto mt-[34px] block drop-shadow-[0_16px_26px_rgba(45,139,163,0.22)]"
    >
      <circle cx="84" cy="84" r={r} fill="none" stroke="#1E2638" strokeWidth="42" />
      <circle
        cx="84"
        cy="84"
        r={r}
        fill="none"
        stroke={negative ? "#F87171" : "#10B981"}
        strokeWidth="42"
        strokeDasharray={`${(c * clamped) / 100} ${c}`}
        transform="rotate(-90 84 84)"
        strokeLinecap="butt"
      />
    </svg>
  );
}

const BUCKET_ICON_BG: Record<string, string> = {
  income: "linear-gradient(155deg,#43b47c,#2c8f5f)",
  bills: "linear-gradient(155deg,#6b8fd6,#4a6ec0)",
  planned: "linear-gradient(155deg,#10B981,#10B981)",
  goals: "linear-gradient(155deg,#5aa2d8,#3b7fb8)",
};

export function FernDashboard({
  monthLabel,
  buckets,
  activeBucketId,
  leftThisMonth,
  spentPct,
  categories,
  unbudgeted,
  plannedTotal,
}: {
  monthLabel: string;
  buckets: FernBucket[];
  activeBucketId: string;
  leftThisMonth: number;
  spentPct: number;
  categories: FernCategory[];
  unbudgeted: FernProject[];
  plannedTotal: number;
}) {
  const [active, setActive] = useState(activeBucketId);
  const [cardView, setCardView] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleUnbudgeted = unbudgeted.filter((u) => !dismissed.has(String(u.id)));
  const leftNegative = leftThisMonth < 0;

  return (
    <div className="fern-panel flex min-h-[800px] items-stretch overflow-hidden max-xl:flex-col">
      {/* Left ledger column */}
      <section aria-label="Сводка за месяц" className="flex w-[362px] shrink-0 flex-col border-r border-[#1E2638] px-6 pb-8 pt-[26px] max-xl:w-full max-xl:border-b max-xl:border-r-0">
        <div className="mb-6 flex items-center justify-between gap-3 px-1">
          <h2 className="m-0 text-[21px] font-bold tracking-[-0.028em] text-[#F8FAFC]">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button className="grid h-9 w-9 place-items-center rounded-[12px] text-[#64748B] transition hover:bg-[#131926] hover:text-[#94A3B8]" aria-label="Предыдущий месяц">
              <ChevronLeft size={17} />
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#131926] text-[#94A3B8] transition hover:bg-[rgba(52,211,153,0.1)] hover:text-[#10B981]" aria-label="Следующий месяц">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {buckets.map((b) => {
            const isActive = active === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActive(b.id)}
                aria-current={isActive}
                className={`relative flex w-full items-center gap-[14px] rounded-[12px] border bg-[#0D121B] p-[13px_16px] text-left shadow-[0_1px_2px_rgba(15,23,32,0.05)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#d8e0e9] hover:shadow-[0_1px_2px_rgba(15,23,32,0.05),0_14px_28px_-18px_rgba(15,23,32,0.35)] ${
                  isActive
                    ? "border-2 border-[#10B981] bg-[#131926] p-[12px_15px] shadow-[0_1px_2px_rgba(22,84,143,0.1),0_12px_24px_-16px_rgba(22,84,143,0.55)]"
                    : "border-[#1E2638]"
                }`}
              >
                <span
                  aria-hidden
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-[#090D14]"
                  style={{ background: BUCKET_ICON_BG[b.id] ?? BUCKET_ICON_BG.planned }}
                >
                  {b.tone === "pos" ? <Plus size={19} strokeWidth={2.6} /> : <Minus size={19} strokeWidth={2.6} />}
                </span>
                <span className={`min-w-0 flex-1 text-[15.5px] tracking-[-0.01em] ${isActive ? "font-semibold text-[#10B981]" : "font-medium text-[#94A3B8]"}`}>
                  {b.label}
                  <span className="block text-xs font-normal text-[#64748B]">{b.sub}</span>
                </span>
                <span className={`num whitespace-nowrap text-[17px] font-bold tracking-[-0.026em] ${b.tone === "pos" ? "text-[#34D399]" : isActive ? "text-[#34D399]" : "text-[#F8FAFC]"}`}>
                  {b.amount < 0 ? "−" : b.tone === "pos" ? "+" : ""}
                  {formatMoney(Math.abs(b.amount)).replace("−", "")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mx-1 my-7 h-px bg-[#1E2638]" />

        <div className="flex items-center gap-[14px] px-1">
          <span
            aria-hidden
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] text-[#090D14]"
            style={{ background: "linear-gradient(155deg,#e07a5f,#c85440)" }}
          >
            <List size={19} strokeWidth={2.6} />
          </span>
          <div className="min-w-0 flex-1 text-center">
            <p className="m-0 text-[14.5px] text-[#94A3B8]">Осталось в этом месяце</p>
            <p className={`num m-0 mt-[3px] text-[30px] font-bold leading-none tracking-[-0.038em] ${leftNegative ? "text-[#F87171]" : "text-[#F8FAFC]"}`}>
              {leftNegative ? "−" : ""}
              {formatMoney(Math.abs(leftThisMonth)).replace("−", "")}
            </p>
          </div>
        </div>

        <Donut spentPct={spentPct} negative={leftNegative} />
      </section>

      {/* Right planned-spend column */}
      <section aria-label="Плановые траты" className="flex min-w-0 flex-1 flex-col px-7 pb-8 pt-[26px]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#1E2638] pb-5">
          <h2 className="m-0 text-[20px] font-bold tracking-[-0.028em] text-[#F8FAFC]">Плановые траты</h2>
          <span className="num text-[20px] font-semibold tracking-[-0.028em] text-[#94A3B8]">
            −{formatMoney(plannedTotal).replace("−", "")}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-[10px]">
            <button className="grid h-10 w-10 place-items-center rounded-full border border-[#1E2638] text-[#94A3B8] transition hover:border-[#d8e0e9] hover:bg-[#131926] hover:text-[#F8FAFC]" aria-label="О плановых тратах">
              <CircleHelp size={18} />
            </button>
            <button className="flex h-10 items-center gap-2 rounded-[12px] border border-[#1E2638] px-[14px] text-[15px] font-medium text-[#94A3B8] transition hover:border-[#d8e0e9] hover:bg-[#131926]">
              Категория
              <ChevronLeft size={15} className="-rotate-90 text-[#64748B]" />
            </button>
            <div className="flex h-10 items-center overflow-hidden rounded-[12px] border border-[#1E2638]" role="group" aria-label="Вид">
              <button
                onClick={() => setCardView(false)}
                className={`grid h-full w-[42px] place-items-center transition ${!cardView ? "bg-[rgba(52,211,153,0.1)] text-[#10B981]" : "text-[#64748B] hover:bg-[#131926] hover:text-[#94A3B8]"}`}
                aria-label="Список"
                aria-pressed={!cardView}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setCardView(true)}
                className={`grid h-full w-[42px] place-items-center border-l border-[#1E2638] transition ${cardView ? "bg-[rgba(52,211,153,0.1)] text-[#10B981]" : "text-[#64748B] hover:bg-[#131926] hover:text-[#94A3B8]"}`}
                aria-label="Карточки"
                aria-pressed={cardView}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            <Link
              href="/finance"
              className="inline-flex h-10 items-center gap-[9px] rounded-[12px] bg-[#10B981] px-[18px] text-[15px] font-semibold tracking-[-0.012em] text-[#090D14] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(15,63,109,0.24),0_12px_22px_-14px_rgba(15,63,109,0.95)] transition hover:-translate-y-[1px] hover:bg-[#059669]"
            >
              <Plus size={17} strokeWidth={1.9} />
              Расход
            </Link>
            <button className="grid h-10 w-[34px] place-items-center rounded-[9px] text-[#64748B] transition hover:bg-[#131926] hover:text-[#94A3B8]" aria-label="Ещё действия">
              <EllipsisVertical size={18} />
            </button>
          </div>
        </div>

        <div className={`flex flex-col gap-4 pt-6 ${!cardView ? "[&>article]:!rounded-[9px]" : ""}`}>
          {categories.map((c) => (
            <article key={c.name} className="fern-row grid grid-cols-[minmax(0,1.36fr)_minmax(0,1.94fr)_minmax(0,0.94fr)_30px] items-center gap-5 px-[22px] py-[18px] max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-4">
              <div>
                <h3 className="m-0 mb-[5px] text-[16.5px] font-bold tracking-[-0.02em] text-[#F8FAFC]">{c.name}</h3>
                <p className="num m-0 flex items-center gap-[7px] whitespace-nowrap text-[13.5px] text-[#94A3B8]">
                  <b className="font-bold text-[#F8FAFC]">{c.txCount}</b> операций · доля <b className="font-bold text-[#F8FAFC]">{c.sharePct}%</b>
                </p>
              </div>
              <div>
                <div className="num mb-[9px] flex items-baseline justify-between gap-3 text-[13.5px] text-[#94A3B8]">
                  <span>Потрачено <b className="font-bold text-[#F8FAFC]">{formatMoney(c.spent)}</b></span>
                  <span>из <b className="font-bold text-[#F8FAFC]">{formatMoney(plannedTotal)}</b></span>
                </div>
                <div className="fern-track">
                  <div className="fern-fill" style={{ width: `${Math.max(0, Math.min(100, c.sharePct))}%` }} />
                </div>
              </div>
              <div className="border-l border-[#1E2638] pl-6 text-right max-lg:border-l-0 max-lg:pl-0 max-lg:text-left">
                <p className="num m-0 flex items-center justify-end gap-[7px] text-[19px] font-bold tracking-[-0.03em] text-[#F8FAFC] max-lg:justify-start">
                  <History size={17} className="shrink-0 text-[#64748B]" />
                  {formatMoney(c.spent)}
                </p>
                <p className="m-0 mt-[3px] text-[13px] text-[#94A3B8]">Всего по категории</p>
              </div>
              <button className="grid h-10 w-[34px] place-items-center rounded-[9px] text-[#64748B] transition hover:bg-[#131926] hover:text-[#94A3B8]" aria-label={`Опции категории ${c.name}`}>
                <EllipsisVertical size={18} />
              </button>
            </article>
          ))}

          {visibleUnbudgeted.map((u) => (
            <article key={u.id} className="fern-row flex items-center gap-[14px] px-5 py-4">
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#e9f3f6] text-[#2b7f95]">
                <ArrowLeftRight size={21} />
              </span>
              <span className="min-w-0 flex-1 text-[16.5px] font-semibold tracking-[-0.018em] text-[#F8FAFC]">
                {u.name}
                <span className="block text-xs font-normal text-[#64748B]">{u.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-[10px]">
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(String(u.id)))}
                  className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#131926] text-[#64748B] transition hover:scale-105 hover:bg-[#f6eceb] hover:text-[#F87171]"
                  aria-label={`Скрыть ${u.name}`}
                >
                  <X size={16} />
                </button>
                <Link
                  href="/finance"
                  className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[rgba(52,211,153,0.1)] text-[#10B981] transition hover:scale-105 hover:bg-[#dceaf5] hover:text-[#34D399]"
                  aria-label={`Запланировать ${u.name}`}
                >
                  <Plus size={16} />
                </Link>
              </span>
            </article>
          ))}

          <article className="fern-row flex items-center bg-[#0D121B] px-[22px] py-[30px] shadow-none hover:!transform-none hover:!shadow-none hover:!border-[rgba(52,211,153,0.2)] hover:!bg-[#f6fafd]">
            <Link href="/finance" className="inline-flex items-center gap-[9px] text-[15.5px] font-semibold tracking-[-0.014em] text-[#10B981]">
              <Plus size={18} />
              Новый расход
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
