import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";
import { TutorStudioHub } from "@/components/tutor/studio/TutorStudioHub";
import {
  getTenantAiUsageSummary,
  getTutorSettings,
  listClassroomGroupsForTenant,
  listPersonasForTenant,
  listScenariosForTenant,
  listStaffVisibleTutorSessions,
  listTutorAssignmentsForTenant,
} from "@/actions/tutor-authoring";

export const metadata = { title: "AI Teachers & Speaking Studio" };
export const dynamic = "force-dynamic";

export default async function TenantAdminAiTeachersPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { company } = await requireTenantAdminPage(domain);

  const [personas, scenarios, settings, sessions, assignments, groups, usage] = await Promise.all([
    listPersonasForTenant(company.id).catch(() => []),
    listScenariosForTenant(company.id).catch(() => []),
    getTutorSettings(company.id).catch(() => ({
      company_id: company.id,
      practice_room_enabled: true,
      free_practice_minutes_per_month: 60,
      allowed_modes: ["voice", "text"] as ("live" | "voice" | "text")[],
      enabled_persona_ids: null,
    })),
    listStaffVisibleTutorSessions(company.id).catch(() => []),
    listTutorAssignmentsForTenant(company.id).catch(() => []),
    listClassroomGroupsForTenant(company.id).catch(() => []),
    getTenantAiUsageSummary(company.id).catch(() => null),
  ]);

  return (
    <>
      <Toaster />
      <div className="container mx-auto max-w-7xl px-4 py-8 pb-24">
        <div className="mb-4 flex justify-end">
          <Link
            href={`/academy/${company.slug}/admin/ai-teachers/reviews`}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-ink hover:border-slate-300"
          >
            Reviews
          </Link>
        </div>
        <TutorStudioHub
          companyId={company.id}
          companyName={company.name}
          companySlug={company.slug}
          initialPersonas={personas}
          initialScenarios={scenarios}
          initialSettings={settings}
          initialSessions={sessions}
          initialAssignments={assignments}
          classroomGroups={groups}
          aiUsage={usage}
        />
      </div>
    </>
  );
}
