import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * POST /api/settings/users/[id]/password — админ задаёт пароль пользователю.
 * Body: { newPassword }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Только администратор может менять пароли" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Некорректный пользователь" }, { status: 400 });
  }

  let body: { newPassword?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 4) {
    return NextResponse.json({ error: "Пароль слишком короткий (минимум 4 символа)" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (user.email.endsWith("@limove.local")) {
    return NextResponse.json({ error: "Служебному пользователю пароль не нужен" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  return NextResponse.json({ ok: true, message: `Пароль для ${user.name} изменён` });
}
