import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readFile } from "fs/promises";
import { join } from "path";
import JSZip from "jszip";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id: parseInt(id) } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();

  // Add invoice file
  if (invoice.invoiceFile) {
    const invPath = join("/app/uploads", invoice.invoiceFile);
    try {
      const invData = await readFile(invPath);
      zip.file(`счёт_${invoice.id}${getExtension(invoice.invoiceFile)}`, invData);
    } catch {
      // file might not exist
    }
  }

  // Add receipt file
  if (invoice.receiptFile) {
    const recPath = join("/app/uploads", invoice.receiptFile);
    try {
      const recData = await readFile(recPath);
      zip.file(`чек_${invoice.id}${getExtension(invoice.receiptFile)}`, recData);
    } catch {
      // file might not exist
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoice_${invoice.id}.zip"`,
    },
  });
}

function getExtension(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot >= 0 ? filePath.substring(dot) : "";
}