import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const domains = await prisma.domainRecord.findMany({
    where: { projectId: project.id },
    orderBy: { expiresAt: "asc" },
  });
  return NextResponse.json(domains);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const domain = await prisma.domainRecord.create({
    data: {
      projectId: project.id,
      name: body.name,
      value: body.value,
      expiresAt: new Date(body.expiresAt),
      reminderDays: body.reminderDays ?? 7,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(domain);
}
