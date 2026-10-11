import { getBotAsync } from "@/lib/telegram-bot";
import { startNotificationServices } from "@/lib/notification-sender";

// Guard against multiple starts on dev hot-reload / module re-eval.
const g = globalThis as unknown as { __tgStarted?: boolean };

export function initTelegram() {
  if (g.__tgStarted) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  g.__tgStarted = true;

  (async () => {
    try {
      const bot = await getBotAsync();
      if (!bot) {
        console.warn("[telegram] token not set — bot disabled.");
        return;
      }
      const me = await bot.api.getMe().catch(() => null);
      void bot.start().catch((e) => console.error("[telegram] polling stopped with error:", e));
      console.log("[telegram] bot polling as @" + ((me && me.username) || "unknown"));
    } catch (e) {
      console.error("[telegram] failed to start bot:", e);
    }
  })();

  // Notification sender + daily expiry cron (no-op until a bot exists).
  startNotificationServices();
}

initTelegram();
