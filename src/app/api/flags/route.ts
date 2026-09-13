import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTrafficDropFlags, getAnnualForecast } from "@/lib/analytics-report";

/** GET /api/flags — флаги «трафик упал» по проектам + сводка цели */
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [trafficDrop, forecast] = await Promise.all([getTrafficDropFlags(), getAnnualForecast()]);
  return NextResponse.json({ trafficDrop, forecast });
}