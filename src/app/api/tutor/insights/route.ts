import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { canInTenant } from "@/lib/authz/context-server";
import { loadTenantTutorInsights } from "@/lib/tutor/insights/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId")?.trim();
  const courseId = searchParams.get("courseId")?.trim() || null;

  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const allowed = await canInTenant("tenant.insights.read", companyId, userId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await loadTenantTutorInsights({ companyId, courseId });
  return NextResponse.json(data);
}
