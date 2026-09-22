import * as React from "react";

/**
 * Shared Fernbrook page shell — same look as the dashboard:
 * flat white panel, ledger-style head (title + total + tools), roomy body.
 */
export function FernPage({
  title,
  sub,
  total,
  tools,
  children,
}: {
  title: string;
  sub?: string;
  total?: React.ReactNode;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fern-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#1E2638] px-7 pb-5 pt-[26px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="m-0 text-[20px] font-bold tracking-[-0.028em] text-[#F8FAFC]">
              {title}
            </h1>
            {total != null && total !== "" && (
              <span className="num text-[20px] font-semibold tracking-[-0.028em] text-[#94A3B8]">
                {total}
              </span>
            )}
          </div>
          {sub && <p className="m-0 mt-1 text-[13.5px] text-[#94A3B8]">{sub}</p>}
        </div>
        {tools && (
          <div className="ml-auto flex flex-wrap items-center gap-[10px]">{tools}</div>
        )}
      </div>
      <div className="space-y-6 px-7 py-6">{children}</div>
    </div>
  );
}
