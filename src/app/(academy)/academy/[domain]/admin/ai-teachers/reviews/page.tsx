import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Toaster } from "@/components/ui/sonner";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";
import { canInTenant } from "@/lib/authz/context-server";
import { listVivaReviewQueue } from "@/lib/tutor/server/viva";
import { loadRetentionAccuracy } from "@/lib/tutor/learner/scheduler-server";
import { VivaReviewQueue, type VivaReviewQueueRow } from "@/components/tutor/studio/VivaReviewQueue";

export const metadata = { title: "Oral check reviews" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "returned", label: "Returned" },
  { key: "all", label: "All" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function summaryOf(evaluation: Record<string, unknown>): string | null {
  const decision = evaluation.decision as { reason?: unknown } | null | undefined;
  if (decision && typeof decision.reason === "string") return decision.reason;
  if (evaluation.gateState === "misconfigured") return "The course's oral check is not set up; the learner asked for a review of their course work.";
  return null;
}

function pct(n: number | null): string {
  return n === null ? "–" : `${Math.round(n * 100)}%`;
}

export default async function TenantVivaReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ domain }, { status }] = await Promise.all([params, searchParams]);
  const { company } = await requireTenantAdminPage(domain);
  const { userId } = await auth();
  if (!userId || !(await canInTenant("tenant.insights.read", company.id, userId))) notFound();

  const filter: FilterKey = FILTERS.some((f) => f.key === status) ? (status as FilterKey) : "pending";
  const [queue, retention] = await Promise.all([
    listVivaReviewQueue({ companyId: company.id, status: filter }),
    loadRetentionAccuracy({ companyId: company.id }),
  ]);

  const rows: VivaReviewQueueRow[] = queue.available
    ? queue.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        status: item.status,
        courseTitle: item.courseTitle,
        learnerName: item.learnerName,
        learnerNote: item.learnerNote,
        reviewerNote: item.reviewerNote,
        summary: summaryOf(item.evaluation),
        createdAt: item.createdAt,
        decidedAt: item.decidedAt,
      }))
    : [];

  const base = `/academy/${company.slug}/admin/ai-teachers`;

  return (
    <>
      <Toaster />
      <div className="container mx-auto max-w-4xl px-4 py-8 pb-24">
        <Link href={base} className="text-sm text-slate-500 hover:text-ink">
          ‹ AI teachers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Oral checks that need a person&apos;s decision, and learners who asked for a review. Approving lets the learner
          claim their certificate.
        </p>

        {retention.available && (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700" aria-label="Retention">
            <p className="font-semibold text-ink">Retention checks</p>
            <p className="mt-1">
              {retention.summary.checks === 0
                ? "No retention checks answered yet. They run 7 and 30 days after an objective becomes secure."
                : `${pct(retention.summary.accuracy)} of ${retention.summary.checks} retention checks passed · 7 days: ${pct(
                    retention.summary.byCheckpoint.d7.accuracy,
                  )} · 30 days: ${pct(retention.summary.byCheckpoint.d30.accuracy)}`}
            </p>
          </section>
        )}

        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filter reviews">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`${base}/reviews?status=${f.key}`}
              aria-current={filter === f.key ? "page" : undefined}
              className={
                filter === f.key
                  ? "rounded-full bg-ink px-3 py-1 text-sm font-medium text-white"
                  : "rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-slate-300"
              }
            >
              {f.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4">
          {queue.available ? (
            <VivaReviewQueue rows={rows} />
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Oral check reviews aren&apos;t switched on yet (database update 20261125000501 pending). Courses that require
              an oral check keep certificates locked until a pass; nothing is issued automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
