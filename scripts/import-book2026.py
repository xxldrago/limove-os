#!/usr/bin/env python3
"""Буxгалтерия 2026 (Excel->CSV) => SQL INSERT для Limove OS.

Правила (согласованы):
- все строки вносятся (190 операций), дата = 1-е число месяца
- paidBy = техпользователь id 3 («—»)
- проект по ключевым словам, иначе NULL
- категории из списка UI: Обслужка, Налог, Хостинг, Подписка, VPN, Продвижение, Другое
"""
import csv, re, sys

import os
BASE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'data', 'book2026-2026.csv')
DST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, 'data', 'book2026.sql')
PAID_BY = 3

MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
          'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
MNUM = {m: i+1 for i, m in enumerate(MONTHS)}

def num(s):
    s = (s or '').strip().replace('\u00a0', '').replace(' ', '').replace(',', '.')
    try:
        return float(s) if s else 0
    except ValueError:
        return 0

def project_of(d):
    if 'камн' in d or 'rskrsk' in d: return 'kamni'
    if 'наследник' in d: return 'naslednik'
    if 'ритуал' in d or 'ritual' in d or re.search(r'\bрс\b', d): return 'rs'
    if 'справочн' in d: return 'spravochnaya'
    if 'крематор' in d: return 'krematoriy'
    if 'сео' in d or 'нейропоиск' in d: return 'rs'
    return None

def cat_in(d):
    if 'сео' in d or 'нейропоиск' in d or 'продвиж' in d or 'ссылк' in d or 'накрут' in d:
        return 'Продвижение'
    return 'Обслужка'

def cat_out(d):
    if 'налог' in d: return 'Налог'
    if 'домен' in d or 'хостинг' in d: return 'Хостинг'
    if ('тильд' in d or 'keys' in d or 'key.so' in d or 'lsi' in d or 'генспарк' in d
            or re.search(r'\bии\b', d) or 'сервис' in d or 'подписк' in d or 'антивирус' in d):
        return 'Подписка'
    if 'впн' in d or 'vpn' in d or 'happ' in d or 'амнези' in d or '2kabana' in d:
        return 'VPN'
    if 'накрут' in d or 'ссылк' in d or 'сео' in d or 'продвиж' in d or 'карт' in d:
        return 'Продвижение'
    return 'Другое'

def esc(s): return s.replace("'", "''")

rows = list(csv.reader(open(SRC, encoding='utf-8-sig')))
out = []
stats = {}
unmapped_proj_out = set()
offsets = []  # [(col, month)]
for i, r in enumerate(rows):
    cells = [c.strip() for c in r]
    if any(c in MNUM for c in cells):
        offsets = [(ci, c) for ci, c in enumerate(cells) if c in MNUM]
        continue
    if not any(cells):
        continue
    if cells[0] in ('Приход', 'Итого', 'Чистый', 'Грязные', 'Леша', 'Гена', 'Ожидаем'):
        continue
    if not offsets:
        continue
    # data row: for each month block with income/expense cells
    for ci, m in offsets:
        ymd = f'2026-{MNUM[m]:02d}-01'
        inc_d = (r[ci] if len(r) > ci else '').strip()
        inc_v = num(r[ci+1]) if len(r) > ci+1 else 0
        exp_d = (r[ci+2] if len(r) > ci+2 else '').strip()
        exp_v = num(r[ci+3]) if len(r) > ci+3 else 0
        if inc_d:
            dl = inc_d.lower()
            out.append(('INCOME', inc_v, inc_d, project_of(dl), cat_in(dl), ymd, m))
        if exp_d:
            dl = exp_d.lower()
            p = project_of(dl)
            if not p: unmapped_proj_out.add(exp_d)
            out.append(('EXPENSE', exp_v, exp_d, p, cat_out(dl), ymd, m))

# skip summary rows: they have no month context but DO match mh? 'Итого' rows: r contains 'Итого' not months -> skipped by mh check. Verify:
print(f'операций: {len(out)} (in={sum(1 for o in out if o[0]=="INCOME")}, out={sum(1 for o in out if o[0]=="EXPENSE")})')
tot_in = sum(o[1] for o in out if o[0] == 'INCOME')
tot_out = sum(o[1] for o in out if o[0] == 'EXPENSE')
print(f'итого: in={tot_in} out={tot_out} net={tot_in-tot_out}')
print('ожидалось: in=2201500 out=567240 net=1634260')
assert len(out) == 190, f'ожидалось 190, получили {len(out)}'
assert tot_in == 2201500.0 and tot_out == 567240.0, 'суммы не сошлись!'

with open(DST, 'w') as f:
    f.write('BEGIN;\n')
    for typ, amt, desc, proj, cat, ymd, m in out:
        pid = f"(SELECT id FROM \"Project\" WHERE slug='{proj}')" if proj else 'NULL'
        f.write(f"INSERT INTO transactions (type, amount, description, \"paidById\", \"projectId\", category, date, \"createdAt\") VALUES ('{typ}', {amt:g}, '{esc(desc)}', {PAID_BY}, {pid}, '{cat}', '{ymd}', now());\n")
    f.write('COMMIT;\n')
print(f'SQL записан: {DST}')
print(f'без проекта расходов: {sum(1 for o in out if o[0]=="EXPENSE" and not o[3])} шт на {sum(o[1] for o in out if o[0]=="EXPENSE" and not o[3]):g} ₽')
print(f'без проекта приходов: {sum(1 for o in out if o[0]=="INCOME" and not o[3])} шт')
