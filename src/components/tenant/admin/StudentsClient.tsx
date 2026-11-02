"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link as LinkIcon, Loader2, MessageCircle, Plus, Search, UserMinus, Users, X, BookPlus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addStudentToCourse, createInvite, createInviteGroup, removeStudent, revokeInvite } from "@/actions/invites";
import { INVITE_STATUS_LABEL, inviteShareMessage, inviteUrl, type InviteExpiryChoice, type InviteStatus } from "@/lib/tenants/invites";
import { whatsappShareUrl } from "@/lib/tenants/get-started";
import { cn } from "@/lib/utils";

export type InviteRow = {
  id: string;
  code: string;
  label: string;
  role: "learner" | "teacher";
  isDefault: boolean;
  courses: string[];
  group: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  status: InviteStatus;
};

export type StudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  joinedAt: string | null;
  courses: string[];
  courseIds: string[];
  groups: string[];
  lastActiveAt: string | null;
};

type Props = {
  companyId: string;
  academyName: string;
  origin: string;
  isAdmin: boolean;
  defaultInviteCode: string | null;
  invitesUnavailable: boolean;
  invites: InviteRow[];
  students: StudentRow[];
  courses: { id: string; title: string; draft: boolean }[];
  groups: { id: string; name: string }[];
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lusaka" });
function formatDate(iso: string | null) {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

const STATUS_CLASS: Record<InviteStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  revoked: "bg-slate-100 text-slate-600 border-slate-200",
  expired: "bg-amber-50 text-amber-800 border-amber-100",
  used_up: "bg-amber-50 text-amber-800 border-amber-100",
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(null);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2500);
    } catch {
      setFailed(key);
    }
  }
  return { copied, failed, copy };
}

export function StudentsClient(props: Props) {
  const { companyId, academyName, origin, isAdmin, defaultInviteCode, invitesUnavailable, invites, students, courses } = props;
  const router = useRouter();
  const { copied, failed, copy } = useCopy();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [groups, setGroups] = useState(props.groups);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [addCourseFor, setAddCourseFor] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const shareMessage = inviteShareMessage(academyName);
  const defaultLink = defaultInviteCode ? inviteUrl(origin, defaultInviteCode) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q));
  }, [students, query]);

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusyKey(key);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.ok) {
          setMessage({ kind: "ok", text: success });
          router.refresh();
        } else {
          setMessage({ kind: "error", text: result.error ?? "Something went wrong." });
        }
      } catch (error) {
        setMessage({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." });
      } finally {
        setBusyKey(null);
        setConfirmRevoke(null);
        setConfirmRemove(null);
        setAddCourseFor(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium",
            message.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          )}
        >
          {message.text}
        </p>
      )}

      {/* ---------------- Invite links ---------------- */}
      <section aria-labelledby="invite-links-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="invite-links-title" className="text-lg font-black text-[#062e39]">Invite links</h2>
            <p className="text-sm text-slate-600">Anyone with a link can join. Revoke a link to turn it off.</p>
          </div>
          {!invitesUnavailable && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-bold text-white hover:bg-[#0b3f4d]"
            >
              <Plus className="h-4 w-4" aria-hidden /> New invite link
            </button>
          )}
        </div>

        {invitesUnavailable ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Invite links need a database update (migration 20261104000000_academy_invites.sql). Ask the platform team to apply it.
          </p>
        ) : (
          <>
            {defaultLink && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your academy link</p>
                <p className="mt-1 break-all font-mono text-sm text-[#062e39]">{defaultLink}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => copy("default", defaultLink)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-bold text-white"
                  >
                    {copied === "default" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                    {copied === "default" ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={whatsappShareUrl(shareMessage, defaultLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                  </a>
                </div>
                {failed === "default" && (
                  <p className="mt-2 text-xs text-red-700">Couldn&apos;t copy. Press and hold the link above to copy it.</p>
                )}
              </div>
            )}

            <ul className="space-y-3">
              {invites.map((inv) => {
                const link = inviteUrl(origin, inv.code);
                const active = inv.status === "active";
                return (
                  <li key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-[#062e39]">
                          {inv.label}
                          {inv.isDefault && <span className="ml-2 text-xs font-semibold text-slate-500">(default)</span>}
                          {inv.role === "teacher" && (
                            <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">Teachers</span>
                          )}
                        </p>
                        <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{link}</p>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold", STATUS_CLASS[inv.status])}>
                        {INVITE_STATUS_LABEL[inv.status]}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                      <div className="col-span-2">
                        <dt className="text-xs text-slate-500">Courses</dt>
                        <dd className="text-slate-800">{inv.courses.length ? inv.courses.join(", ") : "None (academy only)"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Group</dt>
                        <dd className="text-slate-800">{inv.group ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Used</dt>
                        <dd className="text-slate-800">
                          {inv.uses}
                          {inv.maxUses !== null ? ` / ${inv.maxUses}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Expires</dt>
                        <dd className="text-slate-800">{inv.expiresAt ? formatDate(inv.expiresAt) : "Never"}</dd>
                      </div>
                    </dl>

                    {active && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copy(inv.id, link)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#062e39]"
                        >
                          {copied === inv.id ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                          {copied === inv.id ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={whatsappShareUrl(shareMessage, link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                        </a>
                        {isAdmin &&
                          (confirmRevoke === inv.id ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span className="text-sm text-slate-700">
                                {inv.isDefault ? "Turn off and make a new default link?" : "Turn this link off?"}
                              </span>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => run(`revoke-${inv.id}`, () => revokeInvite(companyId, inv.id), "Link revoked.")}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                              >
                                {busyKey === `revoke-${inv.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                                Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevoke(null)}
                                className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-600"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevoke(inv.id)}
                              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" aria-hidden /> Revoke
                            </button>
                          ))}
                      </div>
                    )}
                    {failed === inv.id && (
                      <p className="mt-2 text-xs text-red-700">Couldn&apos;t copy. Press and hold the link above to copy it.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ---------------- Students ---------------- */}
      <section aria-labelledby="students-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="students-title" className="text-lg font-black text-[#062e39]">
              Students <span className="text-slate-500">({students.length})</span>
            </h2>
          </div>
          {students.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search students</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#062e39]"
              />
            </label>
          )}
        </div>

        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-3 font-bold text-[#062e39]">No students yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Share your invite link. Students who use it appear here, already in your classroom.
            </p>
            {defaultLink && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => copy("empty", defaultLink)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-bold text-white"
                >
                  <LinkIcon className="h-4 w-4" aria-hidden />
                  {copied === "empty" ? "Copied" : "Share your invite link"}
                </button>
                <a
                  href={whatsappShareUrl(shareMessage, defaultLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                </a>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
            No student matches &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filtered.map((s) => {
              const name = s.name || s.email || "Unnamed student";
              const notEnrolled = courses.filter((c) => !s.courseIds.includes(c.id));
              return (
                <li key={s.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-[#062e39]">{name}</p>
                      {s.email && s.name && <p className="break-all text-sm text-slate-600">{s.email}</p>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Joined {formatDate(s.joinedAt)}
                      {s.lastActiveAt ? ` · Active ${formatDate(s.lastActiveAt)}` : ""}
                    </p>
                  </div>
                  <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="sr-only">Courses</dt>
                      <dd className="text-slate-700">
                        <span className="text-xs text-slate-500">Courses: </span>
                        {s.courses.length ? s.courses.join(", ") : "None yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Group</dt>
                      <dd className="text-slate-700">
                        <span className="text-xs text-slate-500">Group: </span>
                        {s.groups.length ? s.groups.join(", ") : "—"}
                      </dd>
                    </div>
                  </dl>

                  {isAdmin && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {addCourseFor === s.id ? (
                        <AddCourseForm
                          options={notEnrolled}
                          busy={busyKey === `course-${s.id}`}
                          onCancel={() => setAddCourseFor(null)}
                          onSubmit={(courseId) =>
                            run(`course-${s.id}`, () => addStudentToCourse(companyId, s.id, courseId), `${name} enrolled.`)
                          }
                        />
                      ) : (
                        notEnrolled.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAddCourseFor(s.id)}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#062e39]"
                          >
                            <BookPlus className="h-4 w-4" aria-hidden /> Add to course
                          </button>
                        )
                      )}
                      {confirmRemove === s.id ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-700">Remove {name} from {academyName}?</span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(`remove-${s.id}`, () => removeStudent(companyId, s.id), `${name} removed.`)}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            {busyKey === `remove-${s.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-600"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(s.id)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          <UserMinus className="h-4 w-4" aria-hidden /> Remove
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {isAdmin && students.length > 0 && (
          <p className="text-xs text-slate-500">
            Removing a student ends their access to this academy. Their account and history are kept.
          </p>
        )}
      </section>

      <NewInviteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        companyId={companyId}
        isAdmin={isAdmin}
        courses={courses}
        groups={groups}
        onGroupCreated={(g) => setGroups((prev) => [...prev, g].sort((a, b) => a.name.localeCompare(b.name)))}
        onCreated={(label) => {
          setSheetOpen(false);
          setMessage({ kind: "ok", text: `Invite link "${label}" created.` });
          router.refresh();
        }}
      />
    </div>
  );
}

function AddCourseForm({
  options,
  busy,
  onCancel,
  onSubmit,
}: {
  options: { id: string; title: string }[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (courseId: string) => void;
}) {
  const [courseId, setCourseId] = useState(options[0]?.id ?? "");
  return (
    <span className="inline-flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <label className="sr-only" htmlFor="add-course">Course</label>
      <select
        id="add-course"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm sm:flex-none"
      >
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!courseId || busy}
        onClick={() => onSubmit(courseId)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#062e39] px-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Enroll free
      </button>
      <button type="button" onClick={onCancel} className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-600">
        Cancel
      </button>
    </span>
  );
}

function NewInviteSheet({
  open,
  onOpenChange,
  companyId,
  isAdmin,
  courses,
  groups,
  onGroupCreated,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  isAdmin: boolean;
  courses: { id: string; title: string; draft: boolean }[];
  groups: { id: string; name: string }[];
  onGroupCreated: (group: { id: string; name: string }) => void;
  onCreated: (label: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<"learner" | "teacher">("learner");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState<InviteExpiryChoice>("never");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setLabel("");
    setRole("learner");
    setCourseIds([]);
    setGroupId("");
    setNewGroup("");
    setShowNewGroup(false);
    setMaxUses("");
    setExpires("never");
    setError(null);
  }

  function toggleCourse(id: string) {
    setCourseIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function addGroup() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteGroup(companyId, newGroup);
      if (result.ok) {
        onGroupCreated(result.group);
        setGroupId(result.group.id);
        setNewGroup("");
        setShowNewGroup(false);
      } else {
        setError(result.error);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvite({
          companyId,
          label,
          role,
          courseIds: role === "learner" ? courseIds : [],
          groupId: role === "learner" && groupId ? groupId : null,
          maxUses: maxUses || null,
          expires,
        });
        if (result.ok) {
          onCreated(result.invite.label);
          reset();
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the link.");
      }
    });
  }

  const fieldLabel = "mb-1.5 block text-sm font-bold text-[#062e39]";
  const input = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#062e39]";

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent
        side="right"
        className="overflow-y-auto bg-white data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-lg font-black text-[#062e39]">New invite link</SheetTitle>
          <SheetDescription>Students who use it join your academy and get these courses for free.</SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="space-y-5 px-5 pb-8">
          <div>
            <label htmlFor="invite-label" className={fieldLabel}>Name</label>
            <input
              id="invite-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. ICT Cohort Nov"
              maxLength={80}
              className={input}
            />
          </div>

          {isAdmin && (
            <fieldset>
              <legend className={fieldLabel}>Who is it for?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["learner", "teacher"] as const).map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold",
                      role === r ? "border-[#062e39] bg-[#062e39] text-white" : "border-slate-200 text-[#062e39]"
                    )}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="sr-only"
                    />
                    {r === "learner" ? "Students" : "Teachers"}
                  </label>
                ))}
              </div>
              {role === "teacher" && (
                <p className="mt-2 text-xs text-slate-600">
                  Anyone with this link joins your teaching team. Share it privately and revoke it when you are done.
                </p>
              )}
            </fieldset>
          )}

          {role === "learner" && (
            <>
              <fieldset>
                <legend className={fieldLabel}>Courses</legend>
                {courses.length === 0 ? (
                  <p className="text-sm text-slate-600">No courses yet. Students will join the academy only.</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {courses.map((c) => (
                      <label key={c.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={courseIds.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                          className="h-4 w-4 accent-[#062e39]"
                        />
                        <span className="min-w-0 break-words text-sm text-slate-800">
                          {c.title}
                          {c.draft && <span className="ml-1 text-xs text-slate-500">(draft)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <div>
                <label htmlFor="invite-group" className={fieldLabel}>Class group (optional)</label>
                {showNewGroup ? (
                  <div className="flex gap-2">
                    <input
                      value={newGroup}
                      onChange={(e) => setNewGroup(e.target.value)}
                      placeholder="e.g. Evening class"
                      maxLength={80}
                      className={input}
                      aria-label="New group name"
                    />
                    <button
                      type="button"
                      disabled={!newGroup.trim() || pending}
                      onClick={addGroup}
                      className="h-11 shrink-0 rounded-xl bg-[#062e39] px-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select id="invite-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={input}>
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewGroup(true)}
                      className="h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#062e39]"
                    >
                      Create group
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-max" className={fieldLabel}>Max uses</label>
              <input
                id="invite-max"
                type="number"
                inputMode="numeric"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="No limit"
                className={input}
              />
            </div>
            <div>
              <label htmlFor="invite-expires" className={fieldLabel}>Expires</label>
              <select
                id="invite-expires"
                value={expires}
                onChange={(e) => setExpires(e.target.value as InviteExpiryChoice)}
                className={input}
              >
                <option value="never">Never</option>
                <option value="7d">In 7 days</option>
                <option value="30d">In 30 days</option>
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#062e39] text-base font-bold text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            Create link
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
