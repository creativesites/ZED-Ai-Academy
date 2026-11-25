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
    <div className="container max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand/10 text-brand-text text-[10px] font-bold uppercase tracking-wider mb-2">
          <Sparkles className="h-3 w-3" />
          <span>Team Management</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
          {company.name} <span className="text-brand-text">Staff</span>
        </h1>
        <p className="mt-1 text-slate-500 text-xs sm:text-sm">
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