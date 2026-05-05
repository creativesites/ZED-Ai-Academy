import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, FileText, MessageSquare, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { reviewPracticeSubmission } from "@/actions/practice-exercises";
import type {
  PracticeExerciseFile,
  PracticeExerciseReview,
  PracticeExerciseScore,
  PracticeExerciseSubmission,
} from "@/types/database";

export const metadata = { title: "Practice Submissions" };

type SubmissionRow = PracticeExerciseSubmission & {
  profiles: { full_name: string | null; email: string | null } | null;
  courses: { title: string } | null;
  lessons: { title: string } | null;
  practice_exercise_scores: PracticeExerciseScore | null;
};

type PracticeFileWithUrl = PracticeExerciseFile & {
  signedUrl: string | null;
};

function formatSubmittedAt(value: string | null) {
  if (!value) return "Draft";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function PracticeSubmissionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["instructor", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  let courseIds: string[] | null = null;
  if (profile.role !== "super_admin") {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("instructor_id", userId);
    courseIds = (courses ?? []).map((course) => course.id);
  }

  let submissionsQuery = supabase
    .from("practice_exercise_submissions")
    .select("*, profiles(full_name, email), courses(title), lessons(title), practice_exercise_scores(*)")
    .order("submitted_at", { ascending: false })
    .limit(50);

  if (courseIds) {
    submissionsQuery = submissionsQuery.in("course_id", courseIds.length > 0 ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: submissionsRaw } = await submissionsQuery;

  const submissions = (submissionsRaw ?? []) as unknown as SubmissionRow[];
  const submissionIds = submissions.map((submission) => submission.id);

  const [
    { data: filesRaw },
    { data: reviewsRaw },
  ] = submissionIds.length > 0
    ? await Promise.all([
      supabase
        .from("practice_exercise_files")
        .select("*")
        .in("submission_id", submissionIds),
      supabase
        .from("practice_exercise_reviews")
        .select("*")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];

  const signedUrls = new Map<string, string | null>();
  await Promise.all(((filesRaw ?? []) as PracticeExerciseFile[]).map(async (file) => {
    const { data } = await supabase.storage
      .from(file.bucket_id)
      .createSignedUrl(file.storage_path, 60 * 10);
    signedUrls.set(file.id, data?.signedUrl ?? null);
  }));

  const filesBySubmission = new Map<string, PracticeFileWithUrl[]>();
  for (const file of (filesRaw ?? []) as PracticeExerciseFile[]) {
    const existing = filesBySubmission.get(file.submission_id) ?? [];
    existing.push({ ...file, signedUrl: signedUrls.get(file.id) ?? null });
    filesBySubmission.set(file.submission_id, existing);
  }

  const latestReviewBySubmission = new Map<string, PracticeExerciseReview>();
  for (const review of (reviewsRaw ?? []) as PracticeExerciseReview[]) {
    if (!latestReviewBySubmission.has(review.submission_id)) {
      latestReviewBySubmission.set(review.submission_id, review);
    }
  }

  return (
    <main className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#fd5523]">Creator Studio</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#062e39]">Practice Submissions</h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Review learner exercise submissions, AI scores, uploaded evidence, and items needing human feedback.
          </p>
        </div>
        <Link href="/creator/live-sessions" className="text-sm font-bold text-[#062e39] hover:text-[#fd5523]">
          Live sessions
        </Link>
      </div>

      <div className="grid gap-5">
        {submissions.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-2xl font-bold text-[#062e39]">No submissions yet</h2>
            <p className="mt-2 text-sm text-slate-500">Learner submissions will appear here after practice exercises are added to lessons.</p>
          </div>
        ) : submissions.map((submission) => {
          const score = submission.practice_exercise_scores;
          const files = filesBySubmission.get(submission.id) ?? [];
          const latestReview = latestReviewBySubmission.get(submission.id);

          return (
            <article key={submission.id} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {submission.status.replace(/_/g, " ")}
                    </span>
                    {score?.needs_instructor_review && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        Needs review
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[#062e39]">
                    {submission.courses?.title ?? "Course"} · {submission.lessons?.title ?? "Lesson"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {submission.profiles?.full_name ?? submission.profiles?.email ?? "Learner"} · {formatSubmittedAt(submission.submitted_at)}
                  </p>

                  {submission.text_response && (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                        <MessageSquare className="h-4 w-4" />
                        Response
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{submission.text_response}</p>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {files.map((file) => (
                        file.signedUrl ? (
                          <a
                            key={file.id}
                            href={file.signedUrl}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {file.file_name}
                          </a>
                        ) : (
                          <span key={file.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {file.file_name}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </div>

                <aside className="w-full shrink-0 rounded-2xl bg-[#fff6ee] p-5 lg:w-80">
                  <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#fd5523]">
                    <Sparkles className="h-4 w-4" />
                    AI Feedback
                  </div>
                  {score ? (
                    <>
                      <p className="text-4xl font-bold text-[#062e39]">{Math.round(score.score)}<span className="text-lg text-slate-400">/{Math.round(score.max_score)}</span></p>
                      {score.feedback_summary && <p className="mt-3 text-sm leading-relaxed text-slate-700">{score.feedback_summary}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">No AI score yet.</p>
                  )}

                  {latestReview && (
                    <div className="mt-5 rounded-xl bg-white/70 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Latest review · {latestReview.status.replace(/_/g, " ")}
                      </p>
                      {latestReview.score_override !== null && (
                        <p className="mt-2 text-sm font-bold text-[#062e39]">Override: {Math.round(latestReview.score_override)}/100</p>
                      )}
                      {latestReview.feedback && <p className="mt-2 text-sm leading-relaxed text-slate-700">{latestReview.feedback}</p>}
                    </div>
                  )}

                  <form action={reviewPracticeSubmission} className="mt-5 space-y-3">
                    <input type="hidden" name="submission_id" value={submission.id} />
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Score override</span>
                      <input
                        name="score_override"
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        placeholder="Optional"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#fd5523]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Instructor feedback</span>
                      <textarea
                        name="feedback"
                        rows={4}
                        placeholder="Add feedback for the learner"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#fd5523]"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        name="status"
                        value="reviewed"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-bold text-white"
                      >
                        <Send className="h-4 w-4" />
                        Mark reviewed
                      </button>
                      <button
                        name="status"
                        value="resubmission_requested"
                        className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800"
                      >
                        Request resubmit
                      </button>
                    </div>
                  </form>
                </aside>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
