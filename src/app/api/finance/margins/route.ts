import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProjectMargins, getAnnualForecast } from "@/lib/analytics-report";

/** GET /api/finance/margins — маржинальность проектов + прогноз vs цель */
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [margins, forecast] = await Promise.all([getProjectMargins(), getAnnualForecast()]);
  return NextResponse.json({ margins, forecast });
}