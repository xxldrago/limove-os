#!/usr/bin/env python3
"""
Incremental backup of Limove OS data to Google Sheets via direct PostgreSQL
access.  Only new rows are appended (matched on the numeric `id` column).

Environment variables required:
    DATABASE_URL    PostgreSQL connection string (e.g. postgresql://user:pass@db:5432/limove?schema=public)
    GOOGLE_SHEET_ID  id of the target Google Spreadsheet
    GOOGLE_CREDENTIALS  path to the service-account JSON file
"""

import os
import sys
from datetime import datetime
from typing import Any, Dict, List

import gspread
import psycopg2
from google.oauth2 import service_account
from googleapiclient.discovery import build as build_service

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SPREADSHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "").strip()
CREDENTIALS_PATH = os.environ.get("GOOGLE_CREDENTIALS", "").strip()
DB_URL = os.environ.get("DATABASE_URL", "").strip()

if not all([SPREADSHEET_ID, CREDENTIALS_PATH, DB_URL]):
    print("ERROR: DATABASE_URL, GOOGLE_SHEET_ID, GOOGLE_CREDENTIALS must be set", file=sys.stderr)
    sys.exit(1)

# Sheet (worksheet-title) → list-of-database-table names / SQL queries
TABLES = {
    "Бухгалтерия": "transactions",
    "Проекты": "projects",
    "Счета": "invoices",
    "Долги": "transactions",          # filtered on type = EXPENSE
    "Серверы": "servers",
    "Доступы": "credentials",
    "Домены": "domain_records",
    "Задачи": "tasks",
    "Заметки": "notes",
    "Файлы проекта": "project_files",
    "Фин. цели": "financial_goals",
    "VPN": "vpn_subscriptions",
    "Мониторинг": "site_monitors",
    "Уведомления": "notifications",
    "Метрика (счетчики)": "yandex_metric_counters",
    "Метрика (снимки)": "metric_snapshots",
    "Вебмастер (хосты)": "yandex_webmaster_hosts",
    "SEO (ключи)": "tracked_keywords",
    "SEO (позиции)": "position_snapshots",
    "Акты": "act_of_works",
}

# id-column name (all tables use `id`)
ID_COL = "id"


def now_str() -> str:
    return datetime.now().isoformat(timespec="seconds")


def fmt(val: Any) -> str:
    """Render a DB value into a CSV-safe string."""
    if val is None:
        return ""
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (datetime,)):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    return str(val).replace("\n", " ").replace("\r", "")


def open_sheet():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=scopes)
    gc = gspread.authorize(creds)
    try:
        ss = gc.open_by_key(SPREADSHEET_ID)
    except gspread.SpreadsheetNotFound:
        # fallback via Drive API (already created) — open again
        print(f"Spreadsheet with id {SPREADSHEET_ID} not found via gspread; aborting.")
        raise
    return gc, ss


def worksheet_or_create(ss: gspread.Spreadsheet, title: str) -> gspread.Worksheet:
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        return ss.add_worksheet(title=title, rows=1000, cols=26)


def get_seen_ids(ws: gspread.Worksheet) -> set:
    """Read existing IDs from column 1 (the `id` column)."""
    vals = ws.get_all_values()
    # skip header row
    ret = set()
    for row in vals[1:]:
        if len(row) >= 1 and row[0].strip().isdigit():
            ret.add(int(row[0]))
    return ret


def fetch_rows(conn, sql: str) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql)
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()
    return rows


def main():
    # ---- Google Sheets ----
    gc, ss = open_sheet()

    # ---- Postgres ----
    conn = psycopg2.connect(DB_URL)

    total_added = 0
    total_skipped = 0

    # ------------------------------------------------------------------
    # SQL per sheet-table (joined to projects for slug)
    # ------------------------------------------------------------------
    SQL = {
        "Бухгалтерия": """
            SELECT t.id, t.type AS "Тип", t.amount AS "Сумма", t.description AS "Описание",
                   t.category AS "Категория", t.date AS "Дата", t.createdAt AS "Создано"
            FROM transactions t
            ORDER BY t.id
        """,
        "Проекты": """
            SELECT p.id, p.slug AS "Slug", p.name AS "Название", p.description AS "Описание",
                   p.status AS "Статус", p.createdAt AS "Создано"
            FROM projects p
            ORDER BY p.id
        """,
        "Счета": """
            SELECT i.id, i."invoiceNumber" AS "Номер", i.description AS "Описание", i.amount AS "Сумма",
                   i.status AS "Статус", i."paymentMethod" AS "Метод оплаты", i."paidById" AS "Кто получил",
                   i."dueDate" AS "Срок оплаты", i."paidDate" AS "Дата оплаты"
            FROM invoices i
            ORDER BY i.id
        """,
        "Долги": """
            SELECT t.id, t.type AS "Тип", t.amount AS "Сумма", t.description AS "Кому/От кого",
                   'Ожидает' AS "Статус", t.date AS "Дата"
            FROM transactions t
            WHERE t.type = 'EXPENSE'
            ORDER BY t.id
        """,
        "Серверы": """
            SELECT s.id, s.name AS "Имя", s.ip AS "IP", s.username AS "Логин",
                   s.registrar AS "Регистратор", s."paidUntil" AS "Оплачено до",
                   s.notes AS "Примечание", s."createdAt" AS "Создано"
            FROM servers s
            ORDER BY s.id
        """,
        "Доступы": """
            SELECT c.id, p.slug AS "Проект", c."serviceName" AS "Сервис",
                   c.login AS "Логин", c."passwordEnc" AS "Пароль", c.url AS "URL",
                   c."expiresAt" AS "Срок действия", c.notes AS "Примечание",
                   c."createdAt" AS "Создано"
            FROM credentials c
            LEFT JOIN projects p ON p.id = c."projectId"
            ORDER BY c.id
        """,
        "Домены": """
            SELECT d.id, p.slug AS "Проект", d.domain AS "Домен", d.type AS "Тип записи",
                   d.value AS "Значение", d."expiresAt" AS "Срок действия",
                   d.notes AS "Примечание", d."createdAt" AS "Создано"
            FROM domain_records d
            LEFT JOIN projects p ON p.id = d."projectId"
            ORDER BY d.id
        """,
        "Задачи": """
            SELECT t.id, p.slug AS "Проект", t.title AS "Задача", t.status AS "Статус",
                   t.priority AS "Приоритет", t."dueDate" AS "Срок", t."createdAt" AS "Создано"
            FROM tasks t
            LEFT JOIN projects p ON p.id = t."projectId"
            ORDER BY t.id
        """,
        "Заметки": """
            SELECT n.id, p.slug AS "Проект", n.title AS "Заголовок", n.content AS "Тело",
                   n."createdAt" AS "Создано"
            FROM notes n
            LEFT JOIN projects p ON p.id = n."projectId"
            ORDER BY n.id
        """,
        "Файлы проекта": """
            SELECT pf.id, p.slug AS "Проект", pf."fileName" AS "Имя файла",
                   pf."filePath" AS "Путь", pf."mimeType" AS "Тип", pf."createdAt" AS "Создано"
            FROM project_files pf
            LEFT JOIN projects p ON p.id = pf."projectId"
            ORDER BY pf.id
        """,
        "Фин. цели": """
            SELECT f.id, f.year AS "Год", f."targetAmount" AS "Целевая сумма",
                   f."createdAt" AS "Создано", f."updatedAt" AS "Обновлено"
            FROM financial_goals f
            ORDER BY f.id
        """,
        "VPN": """
            SELECT v.id, v.provider AS "Провайдер", v."serverName" AS "Имя сервера",
                   v."clientName" AS "Клиент", v.url AS "URL/Ключ", v."connectedAt" AS "Подключен",
                   v."expiresAt" AS "Истекает", v.status AS "Статус", v.notes AS "Примечание",
                   v."createdAt" AS "Создано"
            FROM vpn_subscriptions v
            ORDER BY v.id
        """,
        "Мониторинг": """
            SELECT sm.id, p.slug AS "Проект", sm.url AS "URL", sm."checkInterval" AS "Интервал (сек)",
                   CASE WHEN sm."isError" THEN 'DOWN' ELSE 'UP' END AS "Статус",
                   sm."checkedAt" AS "Последняя проверка", sm."createdAt" AS "Создано"
            FROM site_monitors sm
            LEFT JOIN projects p ON p.id = sm."projectId"
            ORDER BY sm.id
        """,
        "Уведомления": """
            SELECT n.id, n.type AS "Тип", n.title AS "Заголовок", n.content AS "Содержимое",
                   n."createdAt" AS "Создано"
            FROM notifications n
            ORDER BY n.id
        """,
        "Метрика (счетчики)": """
            SELECT ym.id, p.slug AS "Проект", ym."counterId" AS "Контр ID",
                   ym.name AS "Контр Название", ym."metricType" AS "Метрика",
                   ym."goalReaches" AS "Посещаемость (цель)",
                   ym."createdAt" AS "Создано", ym."updatedAt" AS "Обновлено"
            FROM yandex_metric_counters ym
            LEFT JOIN projects p ON p.id = ym."projectId"
            ORDER BY ym.id
        """,
        "Метрика (снимки)": """
            SELECT ms.id, ms."counterId" AS "Контр ID", ms.date AS "Дата",
                   ms.visits AS "Посещаемость", ms.users AS "Пользователи",
                   ms.pageviews AS "Просмотры", ms.bounces AS "Отказы",
                   ms."avgSec" AS "Среднее время", ms."goalReaches" AS "Цели"
            FROM metric_snapshots ms
            ORDER BY ms.id
        """,
        "Вебмастер (хосты)": """
            SELECT yw.id, p.slug AS "Проект", yw."hostUrl" AS "Домен",
                   yw.status AS "Статус", yw."verifiedAt" AS "Привязан",
                   yw."createdAt" AS "Создано"
            FROM yandex_webmaster_hosts yw
            LEFT JOIN projects p ON p.id = yw."projectId"
            ORDER BY yw.id
        """,
        "SEO (ключи)": """
            SELECT tk.id, p.slug AS "Проект", tk.keyword AS "Ключевое слово",
                   tk."createdAt" AS "Создано"
            FROM tracked_keywords tk
            LEFT JOIN projects p ON p.id = tk."projectId"
            ORDER BY tk.id
        """,
        "SEO (позиции)": """
            SELECT ps.id, ps."keywordId" AS "Ключ ID", ps.position AS "Позиция",
                   ps.service AS "Сервис", ps.date AS "Дата", ps."createdAt" AS "Создано"
            FROM position_snapshots ps
            ORDER BY ps.id
        """,
        "Акты": """
            SELECT a.id, p.slug AS "Проект", a.description AS "Описание",
                   a.amount AS "Сумма", a.status AS "Статус", a.date AS "Дата",
                   a."createdAt" AS "Создано"
            FROM act_of_works a
            LEFT JOIN projects p ON p.id = a."projectId"
            ORDER BY a.id
        """,
    }

    for sheet_title, sql_key in TABLES.items():
        print(f"[{now_str()}] Sheet: {sheet_title}")
        ws = worksheet_or_create(ss, sheet_title)
        seen = get_seen_ids(ws)

        rows = fetch_rows(conn, SQL[sheet_title])
        # Build row-values, format each cell
        new_rows = []
        skipped = 0
        for r in rows:
            rid = r.get("id")
            if rid in seen:
                skipped += 1
                continue
            # Extract values in column order defined by SQL
            row_vals = [fmt(v) for v in r.values()]
            new_rows.append(row_vals)
            seen.add(rid)

        if new_rows:
            # If header row missing, insert it
            header = list(rows[0].keys()) if rows else []
            existing = ws.get_all_values()
            if len(existing) == 0:
                ws.append_row(header)
            elif len(existing) == 1:
                pass  # assume header already written by user
            ws.append_rows(new_rows, value_input_option="RAW")
            total_added += len(new_rows)
            print(f"   added {len(new_rows)} rows")

        total_skipped += skipped
        if skipped:
            print(f"   skipped {skipped} existing")

    conn.close()
    gc.session.close()
    print(f"[{now_str()}] DONE — added={total_added}, skipped={total_skipped}")


if __name__ == "__main__":
    main()
