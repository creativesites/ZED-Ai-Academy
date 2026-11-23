import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadTenantTutorInsights } from "@/lib/tutor/insights/server";

const STAFF_ROLES = new Set(["company_admin", "teacher", "instructor"]);

async function canReadCompanyInsights(companyId: string, userId: string): Promise<boolean> {
  const db = createServiceClient();
  const [{ data: profile }, { data: company }, { data: member }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db.from("companies").select("admin_id").eq("id", companyId).maybeSingle(),
    db
      .from("company_members")
      .select("role, status")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  if (profile?.role === "super_admin") return true;
  if (company?.admin_id === userId) return true;
  return member?.status === "active" && STAFF_ROLES.has(member.role);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId")?.trim();
  const courseId = searchParams.get("courseId")?.trim() || null;

  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const allowed = await canReadCompanyInsights(companyId, userId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await loadTenantTutorInsights({ companyId, courseId });
  return NextResponse.json(data);
}
