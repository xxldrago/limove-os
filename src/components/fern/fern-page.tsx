import * as React from "react";

/**
 * Каркас страницы: заголовок, итог, инструменты, тело.
 * Нативный CSS (см. .page-* в globals.css).
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
    <div>
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-title-row">
            <h1 className="page-title">{title}</h1>
            {total != null && total !== "" && <span className="page-total">{total}</span>}
          </div>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {tools && <div className="page-tools">{tools}</div>}
      </div>
      <div className="page-body">{children}</div>
    </div>
  );
}
