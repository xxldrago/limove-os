import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { unlink } from "fs/promises";
import { uploadsPath } from "@/lib/uploads";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const file = await prisma.projectFile.findUnique({ where: { id: Number(id) } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete the physical file
  try {
    const absPath = uploadsPath("projects", String(file.projectId), file.fileName);
    if (absPath) await unlink(absPath);
  } catch {
    // File might not exist, continue with DB delete
  }

  await prisma.projectFile.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
