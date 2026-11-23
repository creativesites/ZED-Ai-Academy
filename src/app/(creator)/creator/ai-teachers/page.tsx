import { TutorStudioHub } from "@/components/tutor/studio/TutorStudioHub";
import {
  getTenantAiUsageSummary,
  getTutorSettings,
  listClassroomGroupsForTenant,
  listPersonasForTenant,
  listScenariosForTenant,
  listStaffVisibleTutorSessions,
  listTutorAssignmentsForTenant,
  resolveCreatorCompanyContext,
} from "@/actions/tutor-authoring";

export const metadata = { title: "AI Teachers & Scenarios — Creator Studio" };
export const dynamic = "force-dynamic";

export default async function CreatorAiTeachersPage() {
  const ctx = await resolveCreatorCompanyContext();

  const [personas, scenarios, settings, sessions, assignments, groups, usage] = await Promise.all([
    listPersonasForTenant(ctx.companyId).catch(() => []),
    listScenariosForTenant(ctx.companyId).catch(() => []),
    getTutorSettings(ctx.companyId).catch(() => ({
      company_id: ctx.companyId,
      practice_room_enabled: true,
      free_practice_minutes_per_month: 60,
      allowed_modes: ["voice", "text"] as ("live" | "voice" | "text")[],
      enabled_persona_ids: null,
    })),
    listStaffVisibleTutorSessions(ctx.companyId).catch(() => []),
    listTutorAssignmentsForTenant(ctx.companyId).catch(() => []),
    listClassroomGroupsForTenant(ctx.companyId).catch(() => []),
    getTenantAiUsageSummary(ctx.companyId).catch(() => null),
  ]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 pb-20">
      <TutorStudioHub
        companyId={ctx.companyId}
        companyName={ctx.companyName}
        companySlug={ctx.companySlug}
        initialPersonas={personas}
        initialScenarios={scenarios}
        initialSettings={settings}
        initialSessions={sessions}
        initialAssignments={assignments}
        classroomGroups={groups}
        aiUsage={usage}
      />
    </div>
  );
}
