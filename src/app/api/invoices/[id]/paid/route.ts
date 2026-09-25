import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { markInvoicePaid } from "@/lib/invoices";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const formData = await request.formData();
  const paymentMethod = (formData.get("paymentMethod") as string) || "CASH";
  const paidByIdRaw = formData.get("paidById") as string;
  const file = formData.get("receipt") as File | null;
  const paidDate = formData.get("paidDate") as string;

  try {
    const { invoice } = await markInvoicePaid(parseInt(id), {
      paymentMethod,
      paidById: paidByIdRaw ? parseInt(paidByIdRaw) : undefined,
      paidDate: paidDate ? new Date(paidDate) : undefined,
      receiptName: file && file.size > 0 ? file.name : undefined,
      receiptBytes:
        file && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : undefined,
    });
    return NextResponse.json(invoice);
  } catch (e) {
    if (e instanceof Error && e.message === "Invoice not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
