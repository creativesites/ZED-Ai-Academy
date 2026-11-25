"use client";

import { useState } from "react";
import {
  Users, Key, Copy, Check, RefreshCw,
  Shield, GraduationCap, Trash2,
  Link as LinkIcon, Search,
} from "lucide-react";
import { regenerateStaffCode, updateStaffRole, removeStaffMember } from "@/actions/tenants";
import { toast } from "sonner";
import type { CompanyMemberRole } from "@/types/database";

interface StaffMember {
  id: string;
  profile_id: string;
  role: CompanyMemberRole;
  status: string;
  joined_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface StaffManagementClientProps {
  company: {
    id: string;
    name: string;
    slug: string;
    teacher_code: string | null;
    admin_id: string | null;
    primary_color?: string | null;
  };
  members: StaffMember[];
  currentUserId: string;
}

export function StaffManagementClient({
  company,
  members: initialMembers,
  currentUserId,
}: StaffManagementClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [teacherCode, setTeacherCode] = useState<string | null>(company.teacher_code);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const staffInviteUrl = teacherCode
    ? `${appUrl}/academy/${company.slug}/join?role=teacher&code=${teacherCode}`
    : "";
  const studentInviteUrl = `${appUrl}/academy/${company.slug}/join`;

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRegenerateCode = async () => {
    if (
      teacherCode &&
      !confirm("Are you sure? Anyone with the old staff code will no longer be able to use it.")
    ) {
      return;
    }
    setIsRegenerating(true);
    try {
      const res = await regenerateStaffCode(company.id);
      if (res.newCode) {
        setTeacherCode(res.newCode);
        toast.success("New staff access code generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate code");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: CompanyMemberRole) => {
    try {
      await updateStaffRole(company.id, targetUserId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.profile_id === targetUserId ? { ...m, role: newRole } : m))
      );
      toast.success("Member role updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from this academy?`)) {
      return;
    }
    try {
      await removeStaffMember(company.id, targetUserId);
      setMembers((prev) => prev.filter((m) => m.profile_id !== targetUserId));
      toast.success("Staff member removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.profiles?.full_name?.toLowerCase().includes(q) ||
      member.profiles?.email?.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q)
    );
  });

  const renderRoleBadge = (member: StaffMember, isOwner: boolean) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {member.role === "company_admin" ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
          <GraduationCap className="h-3 w-3" />
          <span>{member.role === "instructor" ? "Instructor" : "Teacher"}</span>
        </span>
      )}

      {isOwner && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
          Owner
        </span>
      )}
    </div>
  );

  const renderMemberActions = (member: StaffMember, name: string, isOwner: boolean) => {
    if (isOwner || currentUserId === member.profile_id) return null;
    const isTeaching = member.role === "teacher" || member.role === "instructor";

    return (
      <div className="flex items-center gap-2">
        {isTeaching ? (
          <button
            onClick={() => handleRoleChange(member.profile_id, "company_admin")}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="Promote to Admin"
          >
            Make Admin
          </button>
        ) : (
          <button
            onClick={() => handleRoleChange(member.profile_id, "teacher")}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="Set as Teacher"
          >
            Make Teacher
          </button>
        )}

        <button
          onClick={() => handleRemoveMember(member.profile_id, name)}
          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
          title="Remove Member"
          aria-label={`Remove ${name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Invite Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Staff Invite Card */}
        <div className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Key className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-ink tracking-tight">
                  Staff Invitation
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Invite teachers and instructors to your academy
                </p>
              </div>
            </div>

            <div className="my-5 sm:my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Staff Access Code
                  </span>
                  <div className="text-xl sm:text-2xl font-mono font-black text-ink tracking-widest mt-0.5 truncate">
                    {teacherCode || "Not generated"}
                  </div>
                </div>
                <button
                  onClick={handleRegenerateCode}
                  disabled={isRegenerating}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-brand-text flex items-center gap-1.5 transition-all shadow-sm"
                  title="Generate a new code to invalidate the old one"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin text-brand-text" : ""}`} />
                  <span>{teacherCode ? "Reset" : "Generate"}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Anyone with this link and code can register as a teacher in{" "}
              <strong>{company.name}</strong>, create courses, and host live sessions.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => copyToClipboard(staffInviteUrl, "staff")}
              disabled={!teacherCode}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ink text-white font-bold text-xs uppercase tracking-wider hover:bg-ink-hover transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedKey === "staff" ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>{teacherCode ? "Copy Staff Invite Link" : "Generate Code First"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Student Join Link Card */}
        <div className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-ink tracking-tight">
                  Student Self-Join Link
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Quick direct link for students to join your academy
                </p>
              </div>
            </div>

            <div className="my-5 sm:my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Direct Join URL
              </span>
              <div className="text-xs font-mono text-slate-600 truncate mt-1">
                {studentInviteUrl}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Share this link in newsletters, WhatsApp groups, or social media. Students who click
              will join your academy and be routed to the classroom.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => copyToClipboard(studentInviteUrl, "student")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand text-white font-bold text-xs uppercase tracking-wider hover:bg-brand-hover transition-all shadow-md shadow-brand/20 active:scale-95"
            >
              {copiedKey === "student" ? (
                <>
                  <Check className="h-4 w-4 text-white" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4" />
                  <span>Copy Student Join Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Staff Members List */}
      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 p-5 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-ink shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-ink tracking-tight">
                Current Staff & Instructors
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                People with teaching or administrative permissions ({members.length})
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-ink placeholder:text-slate-400 focus:bg-white focus:border-brand outline-none transition-all"
            />
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            No matching staff members
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const profile = member.profiles;
                const name = profile?.full_name || "Unknown User";
                const email = profile?.email || "No email";
                const isOwner = company.admin_id === member.profile_id;

                return (
                  <div key={member.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-ink font-bold overflow-hidden shrink-0">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink truncate">{name}</p>
                          <p className="text-xs text-slate-400 truncate">{email}</p>
                        </div>
                      </div>
                      {renderRoleBadge(member, isOwner)}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                      {renderMemberActions(member, name, isOwner)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-4">Member</th>
                    <th className="pb-4">Role</th>
                    <th className="pb-4">Joined</th>
                    <th className="pb-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredMembers.map((member) => {
                    const profile = member.profiles;
                    const name = profile?.full_name || "Unknown User";
                    const email = profile?.email || "No email";
                    const isOwner = company.admin_id === member.profile_id;

                    return (
                      <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-ink font-bold overflow-hidden shrink-0">
                              {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                name.charAt(0)
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-ink">{name}</p>
                              <p className="text-xs text-slate-400">{email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">{renderRoleBadge(member, isOwner)}</td>
                        <td className="py-4 text-xs text-slate-500">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end">
                            {renderMemberActions(member, name, isOwner)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
