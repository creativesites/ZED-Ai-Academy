import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BookOpen, CalendarClock, Users, LinkIcon } from "lucide-react";
import { getInvitePreview } from "@/lib/tenants/invites-server";
import { normalizeInviteCode, type InviteStatus } from "@/lib/tenants/invites";
import { readableTextOn } from "@/lib/color";
import { createServiceClient } from "@/lib/supabase/server";
import { InviteJoinButton } from "./invite-join-button";

/**
 * Public, academy-branded invite page: /i/{code}. Works on the main site and on
 * academy subdomains (src/proxy.ts). It only ever shows the inviting academy.
 */

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const preview = await getInvitePreview(code);
  if (!preview) return { title: { absolute: "Invite link" }, robots: { index: false } };
  return {
    title: { absolute: `Join ${preview.company.name}` },
    description: `You've been invited to join ${preview.company.name}.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `Join ${preview.company.name}`,
      description: `You've been invited to join ${preview.company.name}.`,
      ...(preview.company.logo_url ? { images: [preview.company.logo_url] } : {}),
    },
  };
}

const DEAD_LINK_COPY: Record<Exclude<InviteStatus, "active"> | "invalid", { title: string; body: string }> = {
  invalid: {
    title: "This invite link doesn't work",
    body: "Check that you copied the whole link, or ask your academy to send it again.",
  },
  revoked: {
    title: "This invite link has been turned off",
    body: "Ask your academy for a new link.",
  },
  expired: {
    title: "This invite link has expired",
    body: "Ask your academy for a new link.",
  },
  used_up: {
    title: "This invite link is full",
    body: "It has been used the maximum number of times. Ask your academy for a new link.",
  },
};

function formatClassTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lusaka",
  }).format(new Date(iso));
}

export default async function InvitePage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(rawCode);
  const preview = code ? await getInvitePreview(code) : null;

  if (!preview || preview.status !== "active") {
    const copy = DEAD_LINK_COPY[preview ? (preview.status as Exclude<InviteStatus, "active">) : "invalid"];
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <LinkIcon className="h-6 w-6" aria-hidden />
          </div>
          {preview && (
            <p className="mb-1 text-sm font-semibold text-slate-500">{preview.company.name}</p>
          )}
          <h1 className="text-xl font-black tracking-tight text-[#062e39]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.body}</p>
        </div>
      </main>
    );
  }

  const { company } = preview;
  const brand = company.primary_color || "#fd5523";
  const onBrand = readableTextOn(brand);
  const { userId } = await auth();

  // A signed-in person who is already in the academy just needs a way in.
  let alreadyMember = false;
  if (userId) {
    const { data: member } = await createServiceClient()
      .from("company_members")
      .select("status")
      .eq("company_id", company.id)
      .eq("profile_id", userId)
      .maybeSingle();
    alreadyMember = member?.status === "active";
  }

  const isTeacherInvite = preview.role === "teacher";
  const signUpHref = `/sign-up?role=student&invite=${preview.code}`;
  const signInHref = `/sign-in?invite=${preview.code}&redirect_url=${encodeURIComponent(`/i/${preview.code}`)}`;

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Brand band: brand colour as background only, text picked for contrast. */}
        <div className="px-6 pb-6 pt-8 text-center" style={{ backgroundColor: brand, color: onBrand }}>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-3xl font-black text-[#062e39]">{company.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <p className="text-sm font-semibold opacity-90">You&apos;ve been invited to join</p>
          <h1 className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl">{company.name}</h1>
          {isTeacherInvite && <p className="mt-2 text-sm font-semibold opacity-90">as a teacher</p>}
        </div>

        <div className="space-y-5 px-6 py-6">
          {(preview.courses.length > 0 || preview.groupName || preview.nextClass) && (
            <ul className="space-y-3">
              {preview.courses.length > 0 && (
                <li className="flex gap-3">
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {preview.courses.length === 1 ? "Course" : "Courses"}
                    </p>
                    {preview.courses.map((course) => (
                      <p key={course.id} className="break-words text-sm font-semibold text-[#062e39]">
                        {course.title}
                      </p>
                    ))}
                  </div>
                </li>
              )}
              {preview.groupName && (
                <li className="flex gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Class group</p>
                    <p className="break-words text-sm font-semibold text-[#062e39]">{preview.groupName}</p>
                  </div>
                </li>
              )}
              {preview.nextClass && (
                <li className="flex gap-3">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next live class</p>
                    <p className="break-words text-sm font-semibold text-[#062e39]">{preview.nextClass.title}</p>
                    <p className="text-sm text-slate-600">{formatClassTime(preview.nextClass.startsAt)} (Lusaka time)</p>
                  </div>
                </li>
              )}
            </ul>
          )}

          {!userId ? (
            <div className="space-y-3">
              <Link
                href={signUpHref}
                className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold shadow-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: brand, color: onBrand }}
              >
                Create my account
              </Link>
              <Link
                href={signInHref}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-[#062e39] hover:bg-slate-50"
              >
                I already have an account
              </Link>
              <p className="text-center text-xs text-slate-500">Free to join. It takes about a minute.</p>
            </div>
          ) : alreadyMember ? (
            <InviteJoinButton
              code={preview.code}
              label={`Open ${company.name}`}
              brand={brand}
              onBrand={onBrand}
              note="You're already a member. We'll add anything new from this link and take you in."
            />
          ) : (
            <InviteJoinButton code={preview.code} label={`Join ${company.name}`} brand={brand} onBrand={onBrand} />
          )}
        </div>
      </div>
    </main>
  );
}
