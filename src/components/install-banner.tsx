"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const DISMISS_KEY = "limove-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const { status } = useSession();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Only meaningful on Android/Chrome-on-mobile; skip on desktop.
  const isMobile =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      ("standalone" in navigator && !navigator.standalone) ||
      !!window.matchMedia?.("(display-mode: standalone)").matches === false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const beforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    const appInstalled = () => setPromptEvent(null);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  // Don't show for a dismissed user (7 days) unless a fresh prompt appeared.
  useEffect(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (ts && Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const visible =
    status === "authenticated" && !dismissed && !!promptEvent && isMobile;

  if (!visible) return null;

  const handleInstall = async () => {
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setPromptEvent(null);
    } catch {
      /* ignore */
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="text-sm font-medium">Добавить Limove OS на главный экран</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Позже
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-md bg-[#16548f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c68ad]"
          >
            Установить
          </button>
        </div>
      </div>
    </div>
  );
}