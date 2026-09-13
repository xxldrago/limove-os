import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDecryptedToken } from "@/lib/yandex/client";
import {
  fetchKeywordPositions,
  storePositionCache,
} from "@/lib/yandex/webmaster";

/** GET /api/projects/[slug]/keywords — ключи проекта + последние позиции
 *  ?refresh=1 — обновить позиции из Вебмастера.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";

  const keywords = await prisma.trackedKeyword.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
    include: { snapshots: { orderBy: { date: "desc" }, take: 30 } },
  });

  // Принудительное обновление позиций через Вебмастер
  if (refresh) {
    const host = await prisma.yandexWebmasterHost.findUnique({ where: { projectId: project.id } });
    if (host && host.tokenId && keywords.length > 0) {
      const token = await getDecryptedToken(host.tokenId);
      if (token) {
        const kws = keywords.map((k) => k.keyword);
        const rows = await fetchKeywordPositions(token, host.userId, host.hostId, kws);
        await storePositionCache(project.id, rows);
      }
    }
    // после обновления перечитаем ключи со свежими позициями
    const fresh = await prisma.trackedKeyword.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
      include: { snapshots: { orderBy: { date: "desc" }, take: 30 } },
    });
    return new NextResponse(JSON.stringify({
      keywords: fresh.map((k) => ({
        id: k.id,
        keyword: k.keyword,
        createdAt: k.createdAt,
        positions: k.snapshots
          .map((s) => ({ date: s.date, position: s.position }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      })),
      hasWebmaster: !!host,
    }), { headers: { "Content-Type": "application/json" } });
  }

  const withPositions = keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    createdAt: k.createdAt,
    positions: k.snapshots
      .map((s) => ({ date: s.date, position: s.position }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  }));

  const host = await prisma.yandexWebmasterHost.findUnique({ where: { projectId: project.id } });
  return NextResponse.json({ keywords: withPositions, hasWebmaster: !!host });
}

/** POST body: { keyword } — добавить ключ */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const keyword = (body.keyword || "").trim().toLowerCase();
  if (!keyword) return NextResponse.json({ error: "Введите ключевой запрос" }, { status: 400 });

  const existing = await prisma.trackedKeyword.findUnique({
    where: { projectId_keyword: { projectId: project.id, keyword } },
  });
  if (existing) return NextResponse.json({ error: "Такой ключ уже добавлен" }, { status: 400 });

  const created = await prisma.trackedKeyword.create({
    data: { projectId: project.id, keyword },
  });
  return NextResponse.json({ keyword: created });
}

/** DELETE body: { id } — удалить ключ */
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const project = await prisma.project.findUnique({ where: { slug: params.slug } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trackedKeyword.deleteMany({
    where: { id: Number(body.id), projectId: project.id },
  });
  await prisma.positionSnapshot.deleteMany({ where: { keywordId: Number(body.id) } });
  return NextResponse.json({ ok: true });
}