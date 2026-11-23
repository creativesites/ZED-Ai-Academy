import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import { loadWeakMasteryRows } from "@/lib/tutor/mastery/server";
import { buildRevisionSprintScenario } from "@/lib/tutor/mastery/sprint";

export const dynamic = "force-dynamic";

export default async function TenantRevisionSprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ focus?: string; courseId?: string }>;
}) {
  const [{ domain }, { focus, courseId }] = await Promise.all([params, searchParams]);
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/practice/sprint`);
  }

  const supabase = createClient();
  const { data: company } = await supabase.from("companies").select("id, slug").eq("slug", domain).maybeSingle();
  if (!company) notFound();

  const [weak, courseRes, personaRes] = await Promise.all([
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
    supabase
      .from("ai_personas")
      .select("name, display_name")
      .eq("company_id", company.id)
      .ilike("name", DEFAULT_TEACHER_NAME)
      .limit(1)
      .maybeSingle(),
  ]);

  const teacherName =
    personaRes.data?.display_name ?? personaRes.data?.name ?? DEFAULT_TEACHER_NAME;
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
      scene="Scene_Classroom"
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
