import { StaffManagementClient } from "@/components/tenant/admin/StaffManagementClient";
import { Sparkles } from "lucide-react";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";

export const metadata = {
  title: "Staff & Instructors — Academy Admin",
};

export default async function TenantAdminStaffPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId, supabase, company } = await requireTenantAdminPage(domain, {
    adminOnly: true,
  });

  // Fetch all staff members (admins, teachers, instructors)
  const { data: membersRaw } = await supabase
    .from("company_members")
    .select("id, profile_id, role, status, joined_at, profiles(full_name, email, avatar_url)")
    .eq("company_id", company.id)
    .in("role", ["company_admin", "teacher", "instructor"])
    .order("joined_at", { ascending: true });

  const members = (membersRaw ?? []) as any[];

  return (
    <div className="container max-w-7xl px-4 py-6 sm:py-10">
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-xs font-black uppercase tracking-wider mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Team Management</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#062e39] tracking-tight leading-none uppercase">
          {company.name} <span className="text-[#fd5523]">Staff</span>
        </h1>
        <p className="mt-2 text-slate-500 text-sm sm:text-base font-medium">
          Manage teacher invitations, staff permissions, and student self-join links.
        </p>
      </div>

      <StaffManagementClient
        company={company}
        members={members}
        currentUserId={userId}
      />
    </div>
  );
}