import { join, normalize, sep } from "path";

/**
 * Корень файлового хранилища.
 * В Docker — /app/uploads (WORKDIR), локально можно переопределить
 * через UPLOADS_DIR (например ./uploads).
 */
export function uploadsDir(): string {
  const base = process.env.UPLOADS_DIR || "/app/uploads";
  return base.startsWith("/") ? base : join(process.cwd(), base);
}

/** Абсолютный путь внутри хранилища + защита от path traversal. */
export function uploadsPath(...parts: string[]): string | null {
  const base = uploadsDir();
  const abs = normalize(join(base, ...parts));
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  return abs;
}
