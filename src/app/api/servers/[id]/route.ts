import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";

function publicServer(s: {
  id: number;
  name: string;
  ip: string;
  username: string;
  passwordEnc: string | null;
  registrar: string | null;
  paidUntil: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { passwordEnc: _omit, ...rest } = s;
  return { ...rest, hasPassword: !!s.passwordEnc };
}

async function getServer(id: number) {
  return prisma.server.findUnique({ where: { id } });
}

/** GET /api/servers/:id — полная запись с расшифрованным паролем (для просмотра/редактирования). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const server = await getServer(parseInt((await params).id));
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let password = "";
  if (server.passwordEnc) {
    try {
      password = decrypt(server.passwordEnc);
    } catch {
      password = "";
    }
  }
  return NextResponse.json({ ...publicServer(server), password });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt((await params).id);
  const existing = await getServer(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, ip, username, password, registrar, paidUntil, notes, clearPassword } = body;

  if (!name?.trim() || !ip?.trim()) {
    return NextResponse.json({ error: "Укажите имя и IP сервера" }, { status: 400 });
  }

  const updated = await prisma.server.update({
    where: { id },
    data: {
      name: name.trim(),
      ip: ip.trim(),
      username: username?.trim() || "root",
      // Пароль меняем только если передан новый; флаг clearPassword — стереть.
      ...(clearPassword
        ? { passwordEnc: null }
        : password
          ? { passwordEnc: encrypt(password) }
          : {}),
      registrar: registrar?.trim() || null,
      paidUntil: paidUntil ? new Date(paidUntil) : null,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(publicServer(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt((await params).id);
  const existing = await getServer(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.server.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
