import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { uploadsPath } from "@/lib/uploads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await prisma.projectFile.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // Ensure upload directory exists
  const uploadDir = uploadsPath("projects", String(project.id));
  if (!uploadDir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  await mkdir(uploadDir, { recursive: true });

  const filePath = join(uploadDir, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const projectFile = await prisma.projectFile.create({
    data: {
      projectId: project.id,
      fileName: file.name,
      filePath: `/uploads/projects/${project.id}/${file.name}`,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: Number(session.user.id),
    },
  });

  return NextResponse.json(projectFile);
}
