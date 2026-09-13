import { startMonitorLoop } from "@/lib/monitor";

// Guard against multiple intervals on dev hot-reload / module re-eval.
const g = globalThis as unknown as { __monitorStarted?: boolean };

export function initMonitor() {
  if (g.__monitorStarted) return;
  // Never start during `next build` (static rendering / build phase).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  g.__monitorStarted = true;
  startMonitorLoop();
}

initMonitor();