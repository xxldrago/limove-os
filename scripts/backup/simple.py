"""Simple first backup test — one row to 'Бухгалтерия' sheet."""
import os
import psycopg2
import gspread
from google.oauth2 import service_account

DB_URL = os.environ.get("DATABASE_URL", "postgresql://limove:limove_pass@db:5432/limove")
KEY_PATH = os.environ["GOOGLE_SHEET_KEY_PATH"]
SHEET_ID = os.environ["GOOGLE_SHEET_ID"]

scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds = service_account.Credentials.from_service_account_file(KEY_PATH, scopes=scopes)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SHEET_ID)

# Read latest row
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute(
    "SELECT id, type, amount, description, category, date, createdAt "
    "FROM transactions ORDER BY id DESC LIMIT 1"
)
row = cur.fetchone()
conn.close()

if row:
    ws = ss.worksheet("Бухгалтерия")
    ws.append_row([str(v) if v else "" for v in row])
    print(f"OK: added 1 row to Бухгалтерия (ID={row[0]})")
else:
    print("INFO: no transactions found")
