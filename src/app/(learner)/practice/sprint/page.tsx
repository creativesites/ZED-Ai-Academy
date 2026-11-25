import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import { loadWeakMasteryRows } from "@/lib/tutor/mastery/server";
import { buildRevisionSprintScenario, parseObjectiveIdsParam } from "@/lib/tutor/mastery/sprint";

export const dynamic = "force-dynamic";

export default async function RevisionSprintPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; courseId?: string; objectives?: string }>;
}) {
  const { userId } = await auth();
  const { focus, courseId, objectives } = await searchParams;
  const objectiveIds = parseObjectiveIdsParam(objectives);
  if (!userId) {
    redirect("/sign-in?redirect_url=/practice/sprint");
  }

  const supabase = createClient();
  const [weak, courseRes] = await Promise.all([
    loadWeakMasteryRows({ supabase, userId, courseId: courseId ?? null, limit: 6 }),
    courseId
      ? supabase.from("courses").select("title").eq("id", courseId).maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
  ]);

  const built = buildRevisionSprintScenario({
    personaId: "preview",
    teacherName: DEFAULT_TEACHER_NAME,
    weakObjectives: weak,
    courseTitle: courseRes.data?.title ?? null,
    focusObjective: focus ?? null,
  });

  return (
    <TutorSession
      origin="practice"
      sprint
      sprintCourseId={courseId}
      focusObjective={focus}
      sprintObjectiveIds={objectiveIds}
      scene="Scene_Classroom"
      doneHref="/dashboard"
      preview={{
        teacherName: DEFAULT_TEACHER_NAME,
        title: built.title,
        goal: built.goal,
        maxMinutes: 5,
        modes: ["voice", "text"],
      }}
    />
  );
}
