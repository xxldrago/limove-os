import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDecryptedToken } from "@/lib/yandex/client";
import {
  getMetricData,
  listCounters,
  listGoals,
  MetrikaCounterInfo,
} from "@/lib/yandex/metrika";
import {
  getUserId,
  listHosts,
  fetchTopQueries,
  WbHost,
} from "@/lib/yandex/webmaster";

/** GET /api/projects/[slug]/analytics — состояние подключения + данные за период */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const counter = await prisma.yandexMetricCounter.findUnique({
    where: { projectId: project.id },
    include: { token: true },
  });
  const host = await prisma.yandexWebmasterHost.findUnique({
    where: { projectId: project.id },
    include: { token: true },
  });
  const keywords = await prisma.trackedKeyword.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
  });

  let metricData = null;
  if (counter && counter.tokenId && from && to) {
    const token = await getDecryptedToken(counter.tokenId);
    if (token) {
      try {
        metricData = await getMetricData(
          counter.tokenId,
          counter.counterId,
          from,
          to
        );
      } catch (e) {
        metricData = { error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  let topQueries = null;
  if (host && host.tokenId && from && to) {
    const token = await getDecryptedToken(host.tokenId);
    if (token) {
      try {
        const uid = host.userId;
        topQueries = await fetchTopQueries(token, uid, host.hostId, from, to);
      } catch (e) {
        topQueries = { error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  return NextResponse.json({
    connected: {
      metric: !!counter,
      webmaster: !!host,
    },
    counter: counter ? { id: counter.id, counterId: counter.counterId, name: counter.name } : null,
    host: host ? { id: host.id, hostUrl: host.hostUrl, hostId: host.hostId } : null,
    keywords: keywords.map((k) => ({ id: k.id, keyword: k.keyword })),
    metricData,
    topQueries,
    goals: [],
  });
}

/** POST body: { service: "METRIKA"|"WEBMASTER", counterId?, hostId?, tokenId? } */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const service = body.service;
  const tokenId = body.tokenId;

  if (!service || !tokenId) {
    return NextResponse.json({ error: "service и tokenId обязательны" }, { status: 400 });
  }

  if (service === "METRIKA") {
    const token = await getDecryptedToken(tokenId);
    if (!token) return NextResponse.json({ error: "Токен не найден" }, { status: 400 });
    const counters = await listCounters(token);
    const picked = counters.find((c: MetrikaCounterInfo) => String(c.id) === String(body.counterId));
    if (!picked) return NextResponse.json({ error: "Счётчик не найден" }, { status: 400 });

    await prisma.yandexMetricCounter.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, counterId: picked.id, name: picked.name, tokenId },
      update: { counterId: picked.id, name: picked.name, tokenId },
    });
  } else if (service === "WEBMASTER") {
    const token = await getDecryptedToken(tokenId);
    if (!token) return NextResponse.json({ error: "Токен не найден" }, { status: 400 });
    const uid = await getUserId(token);
    const hosts = await listHosts(token, uid);
    const picked = hosts.find((h: WbHost) => h.hostId === body.hostId);
    if (!picked) return NextResponse.json({ error: "Хост не найден" }, { status: 400 });

    await prisma.yandexWebmasterHost.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, userId: uid, hostId: picked.hostId, hostUrl: picked.hostUrl, tokenId },
      update: { userId: uid, hostId: picked.hostId, hostUrl: picked.hostUrl, tokenId },
    });
  } else {
    return NextResponse.json({ error: "Неизвестный сервис" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}