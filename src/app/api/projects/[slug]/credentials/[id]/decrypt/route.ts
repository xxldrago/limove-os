import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const credential = await prisma.credential.findUnique({ where: { id: Number(id) } });
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const plainPassword = decrypt(credential.passwordEnc);
    return NextResponse.json({ password: plainPassword });
  } catch {
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
}
