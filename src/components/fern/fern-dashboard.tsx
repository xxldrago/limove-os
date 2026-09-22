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
      className="donut"
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
  income: "linear-gradient(155deg,#34D399,#059669)",
  bills: "linear-gradient(155deg,#60a5fa,#3b82f6)",
  planned: "linear-gradient(155deg,#34D399,#10B981)",
  goals: "linear-gradient(155deg,#a78bfa,#8b5cf6)",
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
    <div className="fern-panel dash-grid">
      {/* Левая ledger-колонка */}
      <section aria-label="Сводка за месяц" className="ledger-col">
        <div className="ledger-head">
          <h2 className="ledger-month">{monthLabel}</h2>
          <div className="ledger-nav">
            <button className="icon-btn" aria-label="Предыдущий месяц">
              <ChevronLeft size={17} />
            </button>
            <button className="icon-btn is-filled" aria-label="Следующий месяц">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="ledger">
          {buckets.map((b) => {
            const isActive = active === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActive(b.id)}
                aria-current={isActive}
                className={`bucket${isActive ? " is-active" : ""}`}
              >
                <span
                  aria-hidden
                  className="bucket-icon"
                  style={{ background: BUCKET_ICON_BG[b.id] ?? BUCKET_ICON_BG.planned }}
                >
                  {b.tone === "pos" ? (
                    <Plus size={19} strokeWidth={2.6} />
                  ) : (
                    <Minus size={19} strokeWidth={2.6} />
                  )}
                </span>
                <span className="bucket-name">
                  {b.label}
                  <small>{b.sub}</small>
                </span>
                <span className={`bucket-amount${b.tone === "pos" ? " bucket-amount--pos" : ""}`}>
                  {b.amount < 0 ? "−" : b.tone === "pos" ? "+" : ""}
                  {formatMoney(Math.abs(b.amount)).replace("−", "")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rule" />

        <div className="ledger-left">
          <span aria-hidden className="bucket-icon" style={{ background: "linear-gradient(155deg,#F87171,#EF4444)" }}>
            <List size={19} strokeWidth={2.6} />
          </span>
          <div className="ledger-left-text">
            <p className="ledger-left-label">Осталось в этом месяце</p>
            <p className={`ledger-left-value${leftNegative ? " text-neg" : ""}`}>
              {leftNegative ? "−" : ""}
              {formatMoney(Math.abs(leftThisMonth)).replace("−", "")}
            </p>
          </div>
        </div>

        <Donut spentPct={spentPct} negative={leftNegative} />
      </section>

      {/* Правая колонка категорий */}
      <section aria-label="Плановые траты" className="cat-col">
        <div className="cat-head">
          <h2 className="page-title">Плановые траты</h2>
          <span className="page-total">−{formatMoney(plannedTotal).replace("−", "")}</span>
          <div className="page-tools">
            <button className="icon-btn-round" aria-label="О плановых тратах">
              <CircleHelp size={18} />
            </button>
            <button className="select-like">
              Категория
              <ChevronLeft size={15} className="rotate-90" />
            </button>
            <div className="segment" role="group" aria-label="Вид">
              <button
                onClick={() => setCardView(false)}
                className={`segment-btn${!cardView ? " is-on" : ""}`}
                aria-label="Список"
                aria-pressed={!cardView}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setCardView(true)}
                className={`segment-btn${cardView ? " is-on" : ""}`}
                aria-label="Карточки"
                aria-pressed={cardView}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            <Link href="/finance" className="btn btn-primary">
              <Plus size={17} strokeWidth={1.9} />
              Расход
            </Link>
            <button className="icon-btn" aria-label="Ещё действия">
              <EllipsisVertical size={18} />
            </button>
          </div>
        </div>

        <div className="cat-list">
          {categories.map((c) => (
            <article key={c.name} className="cat-row">
              <div>
                <h3 className="cat-name">{c.name}</h3>
                <p className="cat-meta">
                  <b>{c.txCount}</b> операций · доля <b>{c.sharePct}%</b>
                </p>
              </div>
              <div>
                <div className="meter-head">
                  <span>
                    Потрачено <b>{formatMoney(c.spent)}</b>
                  </span>
                  <span>
                    из <b>{formatMoney(plannedTotal)}</b>
                  </span>
                </div>
                <div className="fern-track">
                  <div
                    className="fern-fill"
                    style={{ width: `${Math.max(0, Math.min(100, c.sharePct))}%` }}
                  />
                </div>
              </div>
              <div className="cat-amount">
                <p className="cat-amount-value">
                  <History size={17} className="cat-amount-icon" />
                  {formatMoney(c.spent)}
                </p>
                <p className="cat-amount-note">Всего по категории</p>
              </div>
            </article>
          ))}

          {visibleUnbudgeted.map((u) => (
            <article key={u.id} className="cat-row cat-row--simple">
              <span aria-hidden className="unbudget-icon">
                <ArrowLeftRight size={21} />
              </span>
              <span className="unbudget-name">
                {u.name}
                <small>{u.detail}</small>
              </span>
              <span className="unbudget-actions">
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(String(u.id)))}
                  className="round-btn round-btn--danger"
                  aria-label={`Скрыть ${u.name}`}
                >
                  <X size={16} />
                </button>
                <Link href="/finance" className="round-btn round-btn--success" aria-label={`Запланировать ${u.name}`}>
                  <Plus size={16} />
                </Link>
              </span>
            </article>
          ))}

          <Link href="/finance" className="add-row">
            <Plus size={18} />
            Новый расход
          </Link>
        </div>
      </section>
    </div>
  );
}
