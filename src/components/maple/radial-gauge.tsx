"use client";

import { useEffect, useRef } from "react";

export function RadialGauge({
  value,
  color,
  label,
  unit,
  reading,
}: {
  value: number; // 0-100
  color: string;
  label: string;
  unit: string;
  reading: string;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const C = 2 * Math.PI * 44;
  const max = C * 0.78;
  const clamped = Math.max(0, Math.min(100, value));

  useEffect(() => {
    const arc = arcRef.current;
    if (!arc) return;
    const target = C - max * (clamped / 100);
    arc.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.style.strokeDashoffset = String(target);
      });
    });
  }, [C, max, clamped]);

  return (
    <div className="flex flex-col items-center">
      <div className="recessed flex h-[120px] w-[120px] items-center justify-center rounded-full">
        <div className="relative flex h-[104px] w-[104px] items-center justify-center">
          <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
            <circle
              cx="52"
              cy="52"
              r="44"
              fill="none"
              stroke="#DCD5CC"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44 * 0.78}
              strokeDashoffset={0}
              transform="rotate(126 52 52)"
            />
            <circle
              ref={arcRef}
              cx="52"
              cy="52"
              r="44"
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44}
              transform="rotate(126 52 52)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className="font-mono text-[15px] font-semibold leading-tight text-[#4a4239]">
              {reading}
            </span>
            <span className="text-[10px] text-[#756a60]">{unit}</span>
          </div>
        </div>
      </div>
      <p className="font-display mt-3 text-sm font-semibold text-[#6b6258]">{label}</p>
    </div>
  );
}
