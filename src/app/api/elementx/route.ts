import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const company = searchParams.get("company");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort"); // registerDate | paidDate | id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { login: { contains: search, mode: "insensitive" } },
    ];
  }
  if (company && company !== "ALL") where.company = company;
  if (status && status !== "ALL") where.status = status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any = {};
  if (sort === "paidDate") orderBy.paidDate = "desc";
  else if (sort === "registerDate") orderBy.registerDate = "desc";
  else orderBy.id = "desc";

  const users = await prisma.elementxUser.findMany({
    where,
    orderBy,
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { fullName, login, registerDate, paidDate, company, status, notes } = body;

  if (!fullName || !login) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const user = await prisma.elementxUser.create({
      data: {
        fullName,
        login,
        registerDate: registerDate ? new Date(registerDate) : new Date(),
        paidDate: paidDate ? new Date(paidDate) : null,
        company: company || null,
        status: status || "TRIAL",
        notes: notes || null,
      },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    // duplicate login
    return NextResponse.json({ error: "Логин уже существует" }, { status: 409 });
  }
}