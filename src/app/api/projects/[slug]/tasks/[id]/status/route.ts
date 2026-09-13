import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const task = await prisma.task.findUnique({ where: { id: Number(id) } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = body.status;
  const newSortOrder = body.sortOrder ?? 0;

  // Update task status and sortOrder
  const updated = await prisma.task.update({
    where: { id: Number(id) },
    data: {
      status: newStatus,
      sortOrder: newSortOrder,
    },
  });

  return NextResponse.json(updated);
}
