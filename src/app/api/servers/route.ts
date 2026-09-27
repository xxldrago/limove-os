import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

/** Публичный вид сервера — без пароля. */
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

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(servers.map(publicServer));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, ip, username, password, registrar, paidUntil, notes } = body;

  if (!name?.trim() || !ip?.trim()) {
    return NextResponse.json({ error: "Укажите имя и IP сервера" }, { status: 400 });
  }

  const server = await prisma.server.create({
    data: {
      name: name.trim(),
      ip: ip.trim(),
      username: username?.trim() || "root",
      passwordEnc: password ? encrypt(password) : null,
      registrar: registrar?.trim() || null,
      paidUntil: paidUntil ? new Date(paidUntil) : null,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(publicServer(server), { status: 201 });
}
