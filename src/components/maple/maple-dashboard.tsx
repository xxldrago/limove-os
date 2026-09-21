"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  Lightbulb,
  LightbulbOff,
  Lock,
  Plus,
  FileText,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { RadialGauge } from "./radial-gauge";

export type MapleProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  income: number;
  expenses: number;
  profit: number;
};

export type MapleTodo = {
  key: string;
  text: string;
  href: string;
  severity: "warning" | "critical";
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return `${Math.round(n)}`;
}

type Mode = "all" | "active" | "profitable";

const MODES: { id: Mode; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "all", label: "Все", icon: LayoutDashboard },
  { id: "active", label: "Активные", icon: FolderKanban },
  { id: "profitable", label: "В плюсе", icon: Wallet },
];

export function MapleDashboard({
  userName,
  projects,
  todos,
  totalIncome,
  totalExpenses,
  profit,
  pendingInvoices,
  clockTemp,
}: {
  userName?: string;
  projects: MapleProject[];
  todos: MapleTodo[];
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  pendingInvoices: number;
  clockTemp: string;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [offIds, setOffIds] = useState<Set<string>>(new Set());
  const [activeScene, setActiveScene] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (mode === "active") return projects.filter((p) => p.status === "ACTIVE");
    if (mode === "profitable") return projects.filter((p) => p.profit > 0);
    return projects;
  }, [mode, projects]);

  const toggle = (id: string) =>
    setOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = totalIncome + totalExpenses;
  const incomePct = total > 0 ? Math.round((totalIncome / total) * 100) : 0;
  const expensePct = total > 0 ? Math.round((totalExpenses / total) * 100) : 0;
  const marginPct =
    totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((profit / totalIncome) * 100))) : 0;

  const [top, ...rest] = filtered;
  const tiles = rest.slice(0, 5);

  return (
    <div className="font-body-maple">
      {/* Header — Maple Ridge House pattern */}
      <header className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-5">
          <div className="raised flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px]">
            <span className="font-display text-2xl font-bold text-[#E8A552]">L</span>
          </div>
          <div>
            <p className="text-sm tracking-wide text-[#756a60]">
              Добрый вечер{userName ? `, ${userName}` : ""}
            </p>
            <h1 className="font-display text-2xl font-bold leading-tight text-[#4a4239]">
              Limove House
            </h1>
            <p className="font-mono mt-0.5 text-xs text-[#756a60]">
              {clockTemp} · {filtered.length} проектов · {todos.length} дел
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`font-display press flex items-center gap-2.5 rounded-[20px] px-5 py-4 text-[15px] font-semibold transition-all active:scale-95 sm:px-8 ${
                  isActive ? "recessed text-[#E8A552]" : "raised text-[#8a7f73]"
                }`}
              >
                <Icon className="text-base" size={18} />
                {m.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[1fr_360px]">
        {/* Left — project tiles */}
        <section>
          <div className="mb-5 flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-semibold text-[#4a4239]">Проекты</h2>
            <span className="text-sm text-[#756a60]">
              {projects.length} проектов · {formatShort(totalIncome)} доход
            </span>
          </div>

          <div className="grid auto-rows-[176px] grid-cols-2 gap-6 lg:grid-cols-4">
            {top ? (
              <article
                className={`flex flex-col rounded-[20px] p-6 col-span-2 row-span-2 ${
                  offIds.has(top.id) ? "dim" : "raised"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#4a4239]">
                      {top.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-[#756a60]">
                      {formatMoney(top.income)} · {offIds.has(top.id) ? "пауза" : top.status}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(top.id)}
                    className={`press flex h-16 w-16 items-center justify-center rounded-[20px] transition-all active:scale-95 ${
                      offIds.has(top.id) ? "raised-sm" : "glow-amber"
                    }`}
                    aria-label="Переключить проект"
                  >
                    {offIds.has(top.id) ? (
                      <LightbulbOff size={26} className="text-[#b5aa9e]" />
                    ) : (
                      <Lightbulb size={26} className="text-[#E8A552]" />
                    )}
                  </button>
                </div>
                <div className="mt-auto flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs text-[#756a60]">Прибыль</p>
                    <p className="font-mono text-3xl font-medium text-[#4a4239]">
                      {formatShort(top.profit)}
                      <span className="text-lg"> ₽</span>
                    </p>
                    <Link
                      href="/projects"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5B7DB1]"
                    >
                      Открыть <ArrowUpRight size={14} />
                    </Link>
                  </div>
                  <div className="w-1/2">
                    <div className="mb-2 flex justify-between text-xs text-[#756a60]">
                      <span>Доход</span>
                      <span className="font-mono text-[#E8A552]">{incomePct}%</span>
                    </div>
                    <div className="recessed-sm h-4 rounded-full p-1">
                      <div className="h-full rounded-full bg-[#E8A552]" style={{ width: `${incomePct}%` }} />
                    </div>
                    <div className="mb-2 mt-3 flex justify-between text-xs text-[#756a60]">
                      <span>Расходы</span>
                      <span className="font-mono text-[#7FB069]">{expensePct}%</span>
                    </div>
                    <div className="recessed-sm h-4 rounded-full p-1">
                      <div className="h-full rounded-full bg-[#7FB069]" style={{ width: `${expensePct}%` }} />
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              <article className="dim flex flex-col rounded-[20px] p-6 col-span-2 row-span-2 items-center justify-center text-center">
                <p className="font-display font-semibold text-[#8a7f73]">Нет проектов в этом режиме</p>
                <p className="mt-1 text-sm text-[#756a60]">Переключите фильтр выше</p>
              </article>
            )}

            {tiles.map((p) => {
              const off = offIds.has(p.id);
              return (
                <article
                  key={p.id}
                  className={`flex flex-col rounded-[20px] p-5 ${off ? "dim" : "raised"}`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className={`font-display text-base font-semibold ${off ? "text-[#8a7f73]" : "text-[#4a4239]"}`}>
                      {p.name}
                    </h3>
                    <button
                      onClick={() => toggle(p.id)}
                      className={`press flex h-11 w-11 items-center justify-center rounded-[16px] transition-all active:scale-95 ${
                        off ? "raised-sm" : p.profit >= 0 ? "glow-sage" : "glow-amber"
                      }`}
                      aria-label={`Переключить ${p.name}`}
                    >
                      {off ? (
                        <LightbulbOff size={18} className="text-[#b5aa9e]" />
                      ) : (
                        <Lightbulb
                          size={18}
                          className={p.profit >= 0 ? "text-[#7FB069]" : "text-[#E8A552]"}
                        />
                      )}
                    </button>
                  </div>
                  <div className="mt-auto">
                    <p className={`font-mono text-2xl font-medium ${off ? "text-[#6b6258]" : "text-[#4a4239]"}`}>
                      {formatShort(p.profit)}
                      <span className="text-sm"> ₽</span>
                    </p>
                    <p className="text-xs text-[#756a60]">
                      {off ? "на паузе" : `${formatShort(p.income)} / −${formatShort(p.expenses)}`}
                    </p>
                  </div>
                </article>
              );
            })}

            {/* Wide tile — second project with dimmer */}
            {filtered[3] && (
              <article className="raised flex flex-col rounded-[20px] p-5 col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#4a4239]">
                      {filtered[0]?.name ?? "Фокус"} · детали
                    </h3>
                    <p className="mt-0.5 text-xs text-[#756a60]">
                      Маржа {marginPct}% · {pendingInvoices} счетов ждут
                    </p>
                  </div>
                  <span className="recessed-sm font-mono rounded-full px-3 py-1 text-xs font-semibold text-[#7FB069]">
                    LIVE
                  </span>
                </div>
                <div className="mt-auto flex items-end justify-between gap-4">
                  <p className="font-mono text-2xl font-medium text-[#4a4239]">
                    {formatShort(profit)}
                    <span className="text-sm"> ₽</span>
                  </p>
                  <div className="w-2/5">
                    <div className="mb-1.5 flex justify-between text-[11px] text-[#756a60]">
                      <span>Маржа</span>
                      <span className="font-mono text-[#E8A552]">{marginPct}%</span>
                    </div>
                    <div className="recessed-sm h-3 rounded-full p-0.5">
                      <div className="h-full rounded-full bg-[#E8A552]" style={{ width: `${marginPct}%` }} />
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* Quick scenes */}
            <article className="raised flex flex-col rounded-[20px] p-5 col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#4a4239]">Быстрые действия</h3>
                <span className="text-xs text-[#756a60]">tap to activate</span>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-3">
                {[
                  { id: "tx", label: "Операция", href: "/finance", icon: Plus, color: "text-[#E8A552]" },
                  { id: "inv", label: "Счёт", href: "/invoices", icon: FileText, color: "text-[#5B7DB1]" },
                  { id: "proj", label: "Проект", href: "/projects", icon: FolderKanban, color: "text-[#7FB069]" },
                ].map((s) => {
                  const Icon = s.icon;
                  const isActive = activeScene === s.id;
                  return (
                    <Link
                      key={s.id}
                      href={s.href}
                      onClick={() => setActiveScene(s.id)}
                      className={`press flex flex-col items-center gap-1.5 rounded-[16px] py-3 transition-all active:scale-95 ${
                        isActive ? "recessed-sm" : "raised-sm"
                      }`}
                    >
                      <Icon size={20} className={s.color} />
                      <span className="text-xs font-semibold text-[#6b6258]">{s.label}</span>
                    </Link>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        {/* Right — energy + checklist */}
        <aside className="flex flex-col gap-7">
          <div className="raised rounded-[20px] p-6">
            <h2 className="font-display mb-5 text-lg font-semibold text-[#4a4239]">Финансы</h2>
            <div className="grid grid-cols-2 gap-5">
              <RadialGauge value={incomePct} color="#E8A552" label="Доход" unit="₽" reading={formatShort(totalIncome)} />
              <RadialGauge value={expensePct} color="#5B7DB1" label="Расходы" unit="₽" reading={formatShort(totalExpenses)} />
              <RadialGauge value={marginPct} color="#7FB069" label="Маржа" unit="%" reading={`${marginPct}`} />
              <RadialGauge
                value={Math.min(100, todos.length * 20)}
                color="#7FB069"
                label="Дела"
                unit="шт"
                reading={`${todos.length}`}
              />
            </div>
          </div>

          <div className="raised rounded-[20px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#4a4239]">Что сделать</h2>
              <span
                className={`recessed-sm rounded-full px-3 py-1 text-xs font-semibold ${
                  todos.length === 0 ? "text-[#7FB069]" : "text-[#E8A552]"
                }`}
              >
                {todos.length === 0 ? "ЧИСТО" : `${todos.length} ДЕЛ`}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {todos.length === 0 && (
                <p className="text-sm text-[#756a60]">Все в порядке 🎉</p>
              )}
              {todos.slice(0, 5).map((t) => (
                <Link key={t.key} href={t.href} className="flex items-center gap-4">
                  <div className="recessed-sm flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]">
                    {t.severity === "critical" ? (
                      <Lock size={18} className="text-[#c25e4e]" />
                    ) : (
                      <Check size={18} className="text-[#7FB069]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-sm font-semibold text-[#4a4239]">{t.text}</p>
                    <p className="text-xs text-[#756a60]">
                      {t.severity === "critical" ? "срочно" : "внимание"}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#5B7DB1]">→</span>
                </Link>
              ))}
              {todos.length > 5 && (
                <p className="font-mono text-xs text-[#756a60]">+ ещё {todos.length - 5}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
