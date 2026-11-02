import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { getOrCreateDefaultInvite, requestOrigin } from "@/lib/tenants/invites-server";
import { inviteStatus } from "@/lib/tenants/invites";
import { StudentsClient, type InviteRow, type StudentRow } from "@/components/tenant/admin/StudentsClient";
import type { AcademyInvite } from "@/types/database";

export const metadata = { title: "Students — Academy Admin" };

export default async function TenantAdminStudentsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/admin/students`);

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, admin_id")
    .eq("slug", domain)
    .maybeSingle();
  if (!company) notFound();

  const access = await getCurrentTenantAccess(company.id);
  const isAdmin = Boolean(access?.isSuperAdmin || access?.tenantRole === "company_admin");
  if (!access || !(isAdmin || isTeachingRole(access.tenantRole))) {
    redirect(`/academy/${company.slug}`);
  }

  // The default "General" link is created the first time anyone needs it.
  const defaultInvite = await getOrCreateDefaultInvite(company.id, userId);

  const [invitesRes, { data: courses }, { data: groups }, { data: membersRaw }] = await Promise.all([
    supabase
      .from("academy_invites")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title, status").eq("company_id", company.id).neq("status", "archived").order("title"),
    supabase.from("classroom_groups").select("id, name").eq("company_id", company.id).order("name"),
    supabase
      .from("company_members")
      .select("profile_id, joined_at, profiles(full_name, email, avatar_url)")
      .eq("company_id", company.id)
      .eq("role", "learner")
      .eq("status", "active")
      .order("joined_at", { ascending: false }),
  ]);

  const invitesUnavailable = Boolean(invitesRes.error);
  const allInvites = ((invitesRes.data ?? []) as AcademyInvite[])
    // Teachers see student links only.
    .filter((inv) => isAdmin || inv.role === "learner");

  const members = (membersRaw ?? []) as unknown as {
    profile_id: string;
    joined_at: string | null;
    profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  }[];
  const studentIds = members.map((m) => m.profile_id);
  const groupList = (groups ?? []) as { id: string; name: string }[];
  const groupIds = groupList.map((g) => g.id);

  const [{ data: enrollments }, { data: groupMembers }, { data: platforms }] = await Promise.all([
    studentIds.length
      ? supabase
          .from("enrollments")
          .select("user_id, course_id, status")
          .eq("company_id", company.id)
          .eq("status", "active")
          .in("user_id", studentIds)
      : Promise.resolve({ data: [] as { user_id: string; course_id: string; status: string }[] }),
    studentIds.length && groupIds.length
      ? supabase.from("classroom_group_members").select("group_id, profile_id").in("group_id", groupIds).in("profile_id", studentIds)
      : Promise.resolve({ data: [] as { group_id: string; profile_id: string }[] }),
    studentIds.length
      ? supabase.from("user_platforms").select("user_id, last_seen_at").in("user_id", studentIds)
      : Promise.resolve({ data: [] as { user_id: string; last_seen_at: string }[] }),
  ]);

  const courseList = (courses ?? []) as { id: string; title: string; status: string }[];
  const courseTitle = new Map(courseList.map((c) => [c.id, c.title]));
  const groupName = new Map(groupList.map((g) => [g.id, g.name]));

  const courseIdsByStudent = new Map<string, string[]>();
  for (const e of (enrollments ?? []) as { user_id: string; course_id: string }[]) {
    if (!courseTitle.has(e.course_id)) continue;
    courseIdsByStudent.set(e.user_id, [...(courseIdsByStudent.get(e.user_id) ?? []), e.course_id]);
  }
  const groupsByStudent = new Map<string, string[]>();
  for (const gm of (groupMembers ?? []) as { group_id: string; profile_id: string }[]) {
    const name = groupName.get(gm.group_id);
    if (!name) continue;
    groupsByStudent.set(gm.profile_id, [...(groupsByStudent.get(gm.profile_id) ?? []), name]);
  }
  const lastSeen = new Map<string, string>();
  for (const p of (platforms ?? []) as { user_id: string; last_seen_at: string }[]) {
    const prev = lastSeen.get(p.user_id);
    if (!prev || p.last_seen_at > prev) lastSeen.set(p.user_id, p.last_seen_at);
  }

  const students: StudentRow[] = members.map((m) => ({
    id: m.profile_id,
    name: m.profiles?.full_name ?? null,
    email: m.profiles?.email ?? null,
    joinedAt: m.joined_at,
    courses: (courseIdsByStudent.get(m.profile_id) ?? []).map((id) => courseTitle.get(id) ?? ""),
    courseIds: courseIdsByStudent.get(m.profile_id) ?? [],
    groups: groupsByStudent.get(m.profile_id) ?? [],
    lastActiveAt: lastSeen.get(m.profile_id) ?? null,
  }));

  const now = new Date();
  const invites: InviteRow[] = allInvites.map((inv) => ({
    id: inv.id,
    code: inv.code,
    label: inv.label,
    role: inv.role,
    isDefault: inv.is_default,
    courses: inv.course_ids.map((id) => courseTitle.get(id)).filter((t): t is string => Boolean(t)),
    group: inv.group_id ? groupName.get(inv.group_id) ?? null : null,
    uses: inv.uses,
    maxUses: inv.max_uses,
    expiresAt: inv.expires_at,
    status: inviteStatus(inv, now),
  }));

  return (
    <div className="container max-w-5xl px-4 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-[#062e39] md:text-4xl">Students</h1>
        <p className="mt-1 text-sm text-slate-600">
          Share a link. Students create an account and land in {company.name}&apos;s classroom, already enrolled.
        </p>
      </div>

      <StudentsClient
        companyId={company.id}
        academyName={company.name}
        origin={await requestOrigin()}
        isAdmin={isAdmin}
        defaultInviteCode={defaultInvite && !defaultInvite.revoked_at ? defaultInvite.code : null}
        invitesUnavailable={invitesUnavailable}
        invites={invites}
        students={students}
        courses={courseList.map((c) => ({ id: c.id, title: c.title, draft: c.status !== "published" }))}
        groups={groupList}
      />
    </div>
  );
}
