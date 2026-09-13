import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.elementxUser.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.login !== undefined) data.login = body.login;
  if (body.registerDate !== undefined)
    data.registerDate = body.registerDate ? new Date(body.registerDate) : new Date();
  if (body.paidDate !== undefined)
    data.paidDate = body.paidDate ? new Date(body.paidDate) : null;
  if (body.company !== undefined) data.company = body.company || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes || null;

  try {
    const user = await prisma.elementxUser.update({
      where: { id: parseInt(params.id) },
      data,
    });
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: "Логин уже существует" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.elementxUser.delete({
    where: { id: parseInt(params.id) },
  });

  return NextResponse.json({ ok: true });
}