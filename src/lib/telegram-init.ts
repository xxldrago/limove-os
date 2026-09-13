import { getBotAsync, telegramEnabled } from "@/lib/telegram-bot";
import { startNotificationServices } from "@/lib/notification-sender";

// Guard against multiple starts on dev hot-reload / module re-eval.
const g = globalThis as unknown as { __tgStarted?: boolean };

export function initTelegram() {
  if (g.__tgStarted) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  g.__tgStarted = true;

  if (!telegramEnabled) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled.");
    return;
  }

  (async () => {
    try {
      const bot = await getBotAsync();
      if (!bot) {
        console.warn("[telegram] no bot instance (token empty) — disabled.");
        return;
      }
      await bot.start();
      console.log("[telegram] Telegram bot started");
    } catch (e) {
      console.error("[telegram] failed to start bot:", e);
    }
  })();

  // Notification sender + daily expiry cron (30s loop + daily).
  startNotificationServices();
}

initTelegram();