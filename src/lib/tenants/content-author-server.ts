import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isContentAuthor } from "@/lib/tenants/content-author";

/** Loads the facts for {@link isContentAuthor} and returns the decision. */
export async function userIsContentAuthor(userId: string): Promise<boolean> {
  const db = createServiceClient();
  const [{ data: profile }, { data: memberships }, { data: owned }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db.from("company_members").select("role").eq("profile_id", userId).eq("status", "active"),
    db.from("companies").select("id").eq("admin_id", userId).limit(1),
  ]);
  return isContentAuthor({
    profileRole: profile?.role ?? null,
    activeMemberRoles: (memberships ?? []).map((m) => String(m.role)),
    ownsAcademy: (owned ?? []).length > 0,
  });
}

/** 403 response when the signed-in user is not a content author anywhere, else null. */
export async function requireContentAuthor(userId: string): Promise<NextResponse | null> {
  if (await userIsContentAuthor(userId)) return null;
  return NextResponse.json({ error: "Only teachers and academy staff can use this tool." }, { status: 403 });
}
