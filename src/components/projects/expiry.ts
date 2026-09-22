export type ExpiryLevel = "green" | "yellow" | "red" | "expired" | "none";

export function expiryInfo(
  expiresAt: string | null,
  reminderDays = 7
): { level: ExpiryLevel; days: number; label: string } {
  if (!expiresAt) return { level: "none", days: Infinity, label: "—" };

  const now = new Date();
  const exp = new Date(expiresAt);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return { level: "expired", days, label: `истёк (${-days} дн. назад)` };
  if (days < 7) return { level: "red", days, label: `${days} дн.` };
  if (days < 30) return { level: "yellow", days, label: `${days} дн.` };
  return { level: "green", days, label: `${days} дн.` };
}

export const EXPIRY_EMOJI: Record<ExpiryLevel, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  expired: "⚫",
  none: "⚪",
};

export const EXPIRY_CLASSES: Record<ExpiryLevel, string> = {
  green: "text-pos",
  yellow: "expiry-warn",
  red: "text-neg",
  expired: "cell-strong",
  none: "hint",
};
