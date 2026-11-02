import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinClient } from "./join-client";
import { ensureTenantMembership, validateAndJoinStaff } from "@/actions/tenants";

export const metadata = {
  title: "Join Academy",
};

interface JoinPageProps {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ code?: string; role?: string }>;
}

export default async function TenantJoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const { domain } = await params;
  const { code, role: rawRole } = await searchParams;
  const { userId } = await auth();

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, teacher_code, status")
    .eq("slug", domain)
    .single();

  if (!company || company.status === "suspended") {
    notFound();
  }

  const role: "teacher" | "learner" = rawRole === "teacher" ? "teacher" : "learner";

  // Check if current user is already a member
  let isAlreadyMember = false;
  let memberRole: string | null = null;

  if (userId) {
    const { data: member } = await supabase
      .from("company_members")
      .select("role, status")
      .eq("company_id", company.id)
      .eq("profile_id", userId)
      .maybeSingle();

    if (member && member.status === "active") {
      isAlreadyMember = true;
      memberRole = member.role;

      // If already a member with sufficient role, send them directly
      if (role === "teacher" && (member.role === "teacher" || member.role === "company_admin")) {
        redirect(`/academy/${company.slug}/admin`);
      }
      if (role === "learner") {
        redirect(`/academy/${company.slug}/classroom`);
      }
    }

    // Auto-join if valid credentials provided
    if (role === "teacher" && code && code === company.teacher_code) {
      await validateAndJoinStaff(company.slug, code);
      redirect(`/academy/${company.slug}/admin`);
    }

    if (role === "learner" && !isAlreadyMember) {
      await ensureTenantMembership(userId, company.id, "learner");
      redirect(`/academy/${company.slug}/classroom`);
    }
  }

  return (
    <JoinClient
      company={company}
      initialCode={code}
      role={role}
      isSignedIn={Boolean(userId)}
      isAlreadyMember={isAlreadyMember}
      memberRole={memberRole}
    />
  );
}