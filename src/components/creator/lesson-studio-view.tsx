import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listAvailablePersonasForCourse,
  listTeacherMomentsForLesson,
  type PersonaRecord,
  type TeacherMomentRecord,
} from "@/actions/tutor-authoring";
import { listTutorScenariosForCourse, type TutorScenarioOption } from "@/actions/tutor-scenarios";
import { LessonEditorClient } from "@/components/creator/lesson-editor-client";
import { Toaster } from "@/components/ui/sonner";
import { getCourseEditorPath, getLessonEditorPath } from "@/lib/courses/course-routes";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import type { ContentBlock, ContentBlockType, Json } from "@/types/database";

export async function LessonStudioView({
  courseId,
  courseTitle,
  lessonId,
  tenantSlug,
}: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  tenantSlug?: string;
}) {
  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, is_preview, module_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) notFound();

  const { data: mod } = await supabase
    .from("modules")
    .select("title, course_id")
    .eq("id", lesson.module_id)
    .single();

  if (!mod || mod.course_id !== courseId) notFound();

  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  const typedBlocks = (blocks ?? []) as ContentBlock[];

  const { data: quizData } = (await supabase
    .from("quizzes")
    .select(
      "id, title, pass_threshold, max_attempts, quiz_questions(id, question, options, correct_indices, explanation, position)"
    )
    .eq("lesson_id", lessonId)
    .maybeSingle()) as {
    data: {
      id: string;
      title: string | null;
      pass_threshold: number;
      max_attempts: number;
      quiz_questions: {
        id: string;
        question: string;
        options: string[];
        correct_indices: number[];
        explanation: string | null;
        position: number;
      }[];
    } | null;
    error: unknown;
  };

  // Course outline, AI Teacher personas, scenarios, and moments.
  const [{ data: courseRow }, { data: outlineRaw }, personaCtx, availableScenarios, momentsRes] = await Promise.all([
    supabase.from("courses").select("slug, status, company_id").eq("id", courseId).single(),
    supabase
      .from("modules")
      .select("id, title, position, lessons(id, title, position)")
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
    listAvailablePersonasForCourse(courseId).catch(() => ({ companyId: ZEDAI_TENANT_ID, personas: [] as PersonaRecord[] })),
    listTutorScenariosForCourse(courseId).catch(() => [] as TutorScenarioOption[]),
    listTeacherMomentsForLesson(lessonId, courseId).catch(() => ({ available: false, moments: [] as TeacherMomentRecord[] })),
  ]);

  const companyId = courseRow?.company_id ?? personaCtx.companyId ?? ZEDAI_TENANT_ID;
  const personas = personaCtx.personas;
  const firstCourseScenario = availableScenarios.find((s) => s.visibility === "course" && s.persona);
  const preferredPersona =
    (firstCourseScenario?.persona
      ? personas.find(
          (p) =>
            p.name === firstCourseScenario.persona?.name ||
            p.display_name === firstCourseScenario.persona?.displayName,
        )
      : undefined) ??
    personas.find(
      (p) =>
        p.name.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase() ||
        p.display_name?.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase(),
    ) ??
    personas[0];
  const ordered = ((outlineRaw ?? []) as { id: string; title: string; lessons: { id: string; title: string; position: number }[] }[])
    .flatMap((m) => [...(m.lessons ?? [])].sort((a, b) => a.position - b.position).map((l) => ({ ...l, moduleTitle: m.title })));
  const idx = ordered.findIndex((l) => l.id === lessonId);
  const toNav = (l?: { id: string; title: string }) =>
    l ? { id: l.id, title: l.title, href: getLessonEditorPath(courseId, l.id, tenantSlug) } : null;

  return (
    <>
      <Toaster position="top-center" />
      <div className="app-surface mx-auto w-full max-w-7xl">
        <LessonEditorClient
          backHref={getCourseEditorPath(courseId, tenantSlug)}
          learnerHref={courseRow?.slug ? `/courses/${courseRow.slug}/learn?lesson=${lessonId}` : null}
          position={{ index: idx, total: ordered.length }}
          prevLesson={toNav(ordered[idx - 1])}
          nextLesson={toNav(ordered[idx + 1])}
          lesson={{
            id: lesson.id,
            title: lesson.title,
            is_preview: lesson.is_preview,
          }}
          courseId={courseId}
          courseTitle={courseTitle}
          courseStatus={courseRow?.status ?? "draft"}
          companyId={companyId}
          moduleTitle={mod.title}
          initialBlocks={typedBlocks.map((b) => ({
            id: b.id,
            type: b.type as ContentBlockType,
            position: b.position,
            content: b.content as Json,
          }))}
          quiz={quizData}
          tenantSlug={tenantSlug}
          personas={personas}
          defaultPersonaId={preferredPersona?.id ?? null}
          availableScenarios={availableScenarios}
          momentsAvailable={momentsRes.available}
          initialMoments={momentsRes.moments}
        />
      </div>
    </>
  );
}
