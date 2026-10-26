"use client";

import { useState } from "react";
import { 
  Users, Key, Copy, Check, RefreshCw, 
  Shield, GraduationCap, Trash2, ArrowUpRight, 
  Sparkles, Link as LinkIcon, UserPlus, AlertCircle 
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
    primary_color: string | null;
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
  const [teacherCode, setTeacherCode] = useState(company.teacher_code || "Not set");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const staffInviteUrl = `${appUrl}/academy/${company.slug}/join?role=teacher&code=${teacherCode}`;
  const studentInviteUrl = `${appUrl}/academy/${company.slug}/join`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRegenerateCode = async () => {
    if (!confirm("Are you sure? Anyone with the old staff code will no longer be able to use it.")) {
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

  return (
    <div className="space-y-10">
      {/* Invite Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Staff Invite Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#062e39] tracking-tight">Staff Invitation</h3>
                  <p className="text-xs text-slate-400 font-medium">Invite teachers and instructors to your academy</p>
                </div>
              </div>
            </div>

            <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Access Code</span>
                  <div className="text-2xl font-mono font-black text-[#062e39] tracking-widest mt-0.5">
                    {teacherCode}
                  </div>
                </div>
                <button
                  onClick={handleRegenerateCode}
                  disabled={isRegenerating}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-[#fd5523] flex items-center gap-1.5 transition-all shadow-sm"
                  title="Generate a new code to invalidate the old one"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin text-[#fd5523]" : ""}`} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Anyone with this link and code can register as a teacher in <strong>{company.name}</strong>, create courses, and host live sessions.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => copyToClipboard(staffInviteUrl, "staff")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#062e39] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#0a4055] transition-all shadow-md active:scale-95"
            >
              {copiedKey === "staff" ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Staff Invite Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Student Join Link Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#062e39] tracking-tight">Student Self-Join Link</h3>
                  <p className="text-xs text-slate-400 font-medium">Quick direct link for students to join your academy</p>
                </div>
              </div>
            </div>

            <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Join URL</span>
              <div className="text-xs font-mono text-slate-600 truncate mt-1">
                {studentInviteUrl}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Share this link in newsletters, WhatsApp groups, or social media. Students who click will join your academy and be routed to the classroom.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => copyToClipboard(studentInviteUrl, "student")}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#fd5523] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#ea4817] transition-all shadow-md shadow-[#fd5523]/20 active:scale-95"
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
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#062e39]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#062e39] tracking-tight">Current Staff & Instructors</h2>
              <p className="text-xs text-slate-400 font-medium">People with teaching or administrative permissions in this academy</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            {members.length} Staff Member(s)
          </span>
        </div>

        <div className="overflow-x-auto">
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
              {members.map((member) => {
                const profile = member.profiles;
                const name = profile?.full_name || "Unknown User";
                const email = profile?.email || "No email";
                const isOwner = company.admin_id === member.profile_id;
                const isSelf = currentUserId === member.profile_id;

                return (
                  <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-[#062e39] font-bold overflow-hidden shrink-0">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#062e39]">{name}</p>
                          <p className="text-xs text-slate-400">{email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {member.role === "company_admin" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                            <Shield className="h-3 w-3" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                            <GraduationCap className="h-3 w-3" />
                            <span>Teacher</span>
                          </span>
                        )}

                        {isOwner && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 text-xs text-slate-500">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>

                    <td className="py-4 text-right">
                      {!isOwner && (
                        <div className="flex items-center justify-end gap-2">
                          {member.role === "teacher" ? (
                            <button
                              onClick={() => handleRoleChange(member.profile_id, "company_admin")}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
                              title="Promote to Admin"
                            >
                              Make Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleChange(member.profile_id, "teacher")}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
                              title="Set as Teacher"
                            >
                              Make Teacher
                            </button>
                          )}

                          <button
                            onClick={() => handleRemoveMember(member.profile_id, name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Remove Member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}