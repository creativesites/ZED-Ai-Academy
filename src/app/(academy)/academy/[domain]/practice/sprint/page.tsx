import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import { loadWeakMasteryRows } from "@/lib/tutor/mastery/server";
import { buildRevisionSprintScenario, parseObjectiveIdsParam } from "@/lib/tutor/mastery/sprint";
import { personaLookFromVariant } from "@/lib/tutor/tutor-session-block";

export const dynamic = "force-dynamic";

export default async function TenantRevisionSprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ focus?: string; courseId?: string; objectives?: string }>;
}) {
  const [{ domain }, { focus, courseId, objectives }] = await Promise.all([params, searchParams]);
  const objectiveIds = parseObjectiveIdsParam(objectives);
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/practice/sprint`);
  }

  const supabase = createClient();
  const { data: company } = await supabase.from("companies").select("id, slug").eq("slug", domain).maybeSingle();
  if (!company) notFound();

  const [weak, courseRes, settingsRes, personaRes] = await Promise.all([
    loadWeakMasteryRows({
      supabase,
      userId,
      companyId: company.id,
      courseId: courseId ?? null,
      limit: 6,
    }),
    courseId
      ? supabase.from("courses").select("title").eq("id", courseId).maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
    (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: unknown) => {
            maybeSingle: () => Promise<{
              data: { default_persona_id?: string | null } | null;
              error: { code?: string; message?: string } | null;
            }>;
          };
        };
      };
    })
      .from("tutor_settings")
      .select("default_persona_id")
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("ai_personas")
      .select("name, display_name, rive_variant")
      .eq("company_id", company.id)
      .ilike("name", DEFAULT_TEACHER_NAME)
      .limit(1)
      .maybeSingle(),
  ]);

  const defaultPersonaId = settingsRes.error ? null : settingsRes.data?.default_persona_id ?? null;
  const configuredPersona = defaultPersonaId
    ? (
        await supabase
          .from("ai_personas")
          .select("name, display_name, rive_variant")
          .eq("id", defaultPersonaId)
          .maybeSingle()
      ).data
    : null;

  const chosenPersona = configuredPersona ?? personaRes.data;
  const teacherName =
    chosenPersona?.display_name ?? chosenPersona?.name ?? DEFAULT_TEACHER_NAME;
  const previewLook = personaLookFromVariant(chosenPersona?.rive_variant);
  const built = buildRevisionSprintScenario({
    personaId: "preview",
    teacherName,
    weakObjectives: weak,
    courseTitle: courseRes.data?.title ?? null,
    focusObjective: focus ?? null,
  });

  return (
    <TutorSession
      origin="practice"
      sprint
      companyId={company.id}
      sprintCourseId={courseId}
      focusObjective={focus}
      sprintObjectiveIds={objectiveIds}
      scene="Scene_Classroom"
      look={previewLook}
      doneHref={`/academy/${domain}/dashboard`}
      preview={{
        teacherName,
        title: built.title,
        goal: built.goal,
        maxMinutes: 5,
        modes: ["voice", "text"],
      }}
    />
  );
}
