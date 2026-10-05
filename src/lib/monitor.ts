import { prisma } from "@/lib/prisma";

const CHECK_TIMEOUT = 30_000; // 30s — не спешим хоронить сайт при медленном ответе
const LOOP_INTERVAL = 30_000; // poll for due sites every 30s
const KEEP_CHECKS = 1000; // keep last 1000 checks per site

// Mutex to prevent concurrent checkAllDueSites runs
let _checking = false;

interface SiteCheckInput {
  id: number;
  url: string;
  name: string;
  isError: boolean;
  downSince: Date | null;
  checkedAt: Date | null;
  checkInterval: number;
}

function isOk(code: number | null): boolean {
  // 200 OK, 301/302 redirects are considered healthy
  return code === 200 || code === 301 || code === 302;
}

function formatDownDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return `${hours} ч ${remMin} мин`;
  const days = Math.floor(hours / 24);
  return `${days} дн ${hours % 24} ч`;
}

/**
 * Perform a single HTTP check for one site and persist the result.
 * Idempotent: reads current site state, computes transition, writes DB.
 */
export async function checkSite(site: SiteCheckInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
  const start = Date.now();
  let statusCode: number | null = null;
  let errorMsg = "";
  let ok = false;

  try {
    const res = await fetch(site.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Limove-Monitor/1.0",
        "Accept": "*/*",
      },
    });
    statusCode = res.status;
    ok = isOk(res.status);
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.name === "AbortError") {
      errorMsg = "Таймаут (30 сек)";
    } else {
      errorMsg = err?.message || "Сетевая ошибка";
    }
    ok = false;
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - start;
  const now = new Date();

  // Aтомарная смена статуса через updateMany: только один вызов
  // из конкурентных получит count=1 — остальные count=0 и не дублируют уведомление.
  let notification: { title: string; content: string } | null = null;
  let finalDownSince = site.downSince;

  if (ok) {
    // Восстановление: меняем isError=true → false
    const res = await prisma.siteMonitor.updateMany({
      where: { id: site.id, isError: true },
      data: {
        lastStatus: statusCode,
        lastLatency: latencyMs,
        isError: false,
        downSince: null,
        checkedAt: now,
      },
    });
    if (res.count === 1) {
      const downMs = site.downSince ? now.getTime() - site.downSince.getTime() : 0;
      notification = {
        title: "Сайт восстановлен",
        content: `🟢 Сайт ВОССТАНОВЛЕН: ${site.name} (${site.url})\nБыл в дауне: ${formatDownDuration(downMs)}`,
      };
    } else {
      // Кто-то другой уже обнулil isError (или он уже был false) — просто обновляем метрики
      await prisma.siteMonitor.update({
        where: { id: site.id },
        data: { lastStatus: statusCode, lastLatency: latencyMs, checkedAt: now },
      });
    }
    finalDownSince = null;
  } else {
    // Падение: меняем isError=false → true
    const res = await prisma.siteMonitor.updateMany({
      where: { id: site.id, isError: false },
      data: {
        lastStatus: statusCode,
        lastLatency: latencyMs,
        isError: true,
        downSince: now,
        checkedAt: now,
      },
    });
    if (res.count === 1) {
      finalDownSince = now;
      notification = {
        title: "Сайт упал",
        content: `🔴 Сайт УПАЛ: ${site.name} (${site.url})\nКод ответа: ${statusCode ?? "-"}\nОшибка: ${errorMsg || "-"}\nВремя: ${now.toLocaleString("ru-RU")}`,
      };
    } else {
      // Уже в дауне — просто обновляем метрики, не пересоздаём downSince
      await prisma.siteMonitor.update({
        where: { id: site.id },
        data: { lastStatus: statusCode, lastLatency: latencyMs, checkedAt: now },
      });
    }
  }

  await prisma.siteCheck.create({
    data: {
      siteId: site.id,
      statusCode,
      latencyMs,
      isError,
      checkedAt: now,
    },
  });

  if (notification) {
    await prisma.notification.create({
      data: {
        type: "MONITOR",
        title: notification.title,
        content: notification.content,
      },
    });
    console.log(`[monitor] ${notification.title}: ${site.name}`);
  }

  // Prune: keep last 1000 checks per site
  await pruneChecks(site.id);

  return { statusCode, latencyMs, isError, downSince, ok, errorMsg };
}

async function pruneChecks(siteId: number) {
  const latest = await prisma.siteCheck.findMany({
    where: { siteId },
    orderBy: { id: "desc" },
    take: KEEP_CHECKS,
    select: { id: true },
  });
  if (latest.length >= KEEP_CHECKS) {
    await prisma.siteCheck.deleteMany({
      where: {
        siteId,
        id: { notIn: latest.map((c) => c.id) },
      },
    });
  }
}

/**
 * Run checks for all due active sites (respecting each site's checkInterval).
 * Resilient: a failure in one site does not stop others.
 */
export async function checkAllDueSites() {
  if (_checking) {
    console.log("[monitor] skipping — previous cycle still running");
    return 0;
  }
  _checking = true;
  try {
    return await _checkAllDueSitesInner();
  } finally {
    _checking = false;
  }
}

async function _checkAllDueSitesInner() {
  const now = Date.now();
  const sites = await prisma.siteMonitor.findMany({
    where: { isActive: true },
  });

  const due = sites.filter((s) => {
    if (!s.checkedAt) return true;
    return now - s.checkedAt.getTime() >= s.checkInterval * 1000;
  });

  if (due.length === 0) return 0;

  // Mark all due sites as "in-progress" (update checkedAt) to prevent overlapping cycles
  const nowDate = new Date(now);
  await Promise.all(
    due.map((s) =>
      prisma.siteMonitor.update({
        where: { id: s.id },
        data: { checkedAt: nowDate },
      })
    )
  );

  for (const site of due) {
    try {
      const r = await checkSite(site);
      console.log(
        `[monitor] checked ${site.name} (${site.url}) -> ${r.ok ? "UP" : "DOWN"} ${r.statusCode ?? "-"} ${r.latencyMs}ms`
      );
    } catch (e) {
      console.error(`[monitor] error checking ${site.url}: ${e}`);
    }
  }

  console.log(`[monitor] cycle done: ${due.length} site(s) at ${new Date(now).toISOString()}`);
  return due.length;
}

/**
 * Start the background monitoring loop. Returns the interval handle.
 */
export function startMonitorLoop() {
  // Run one immediate cycle, then poll every LOOP_INTERVAL.
  checkAllDueSites().catch((e) =>
    console.error("[monitor] initial cycle failed:", e)
  );

  const interval = setInterval(() => {
    checkAllDueSites().catch((e) =>
      console.error("[monitor] cycle failed:", e)
    );
  }, LOOP_INTERVAL);

  if (typeof interval.unref === "function") interval.unref();

  console.log(`[monitor] loop started (interval ${LOOP_INTERVAL / 1000}s)`);
  return interval;
}