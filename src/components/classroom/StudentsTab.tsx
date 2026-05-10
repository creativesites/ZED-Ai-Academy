"use client";

import { useState, useEffect } from "react";
import { 
  Users, Mail, UserPlus, Search, MoreVertical, 
  Trash2, UserCheck, Shield, Loader2, Sparkles,
  LayoutGrid, ListFilter, UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCompanyStudents, getClassroomGroups, addGroupMember, removeGroupMember } from "@/actions/classroom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";

export function StudentsTab({ companyId, isAdminOrInstructor, companySlug }: { companyId: string, isAdminOrInstructor: boolean, companySlug: string }) {
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [studentData, groupData] = await Promise.all([
          getCompanyStudents(companyId),
          getClassroomGroups(companyId)
        ]);
        setStudents(studentData);
        setGroups(groupData);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-slate-50/30">
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-[#062e39] tracking-tight flex items-center gap-3">
              Student Directory
              <Users className="h-7 w-7 text-[#fd5523]" />
            </h2>
            <p className="text-slate-500 font-medium mt-1">Manage and track your academy's learners.</p>
          </div>
          {isAdminOrInstructor && (
            <Button 
              onClick={() => {
                const url = `${window.location.origin}/academy/${companySlug}`;
                navigator.clipboard.writeText(url);
                toast.success("Invite Link Copied!", {
                  description: "Send this to your students so they can sign up."
                });
              }}
              className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-2xl h-12 px-6 font-black text-sm uppercase tracking-widest shadow-xl shadow-[#fd5523]/20 transition-all hover:scale-[1.02] flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Student
            </Button>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#fd5523] transition-colors" />
            <Input 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 rounded-2xl border-slate-100 bg-white shadow-sm focus:ring-[#fd5523]/10 focus:border-[#fd5523]/30 transition-all font-medium"
            />
          </div>
          <Button variant="outline" className="h-14 w-14 rounded-2xl border-slate-100 bg-white shrink-0 shadow-sm text-slate-400 hover:text-[#fd5523]">
            <ListFilter className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Student List */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#fd5523]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Accessing Student Records...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredStudents.map((student) => (
              <div key={student.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#fd5523]/30 transition-all group flex items-center gap-6 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <LayoutGrid className="h-24 w-24" />
                </div>
                
                <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-500">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-8 w-8 text-slate-200" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-black text-[#062e39] truncate group-hover:text-[#fd5523] transition-colors">{student.full_name || "Unknown Learner"}</h4>
                    <div className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-100">Active</div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400 font-bold text-xs truncate">
                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {student.email}</span>
                  </div>
                </div>

                {isAdminOrInstructor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={(props) => (
                      <Button {...props} variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-50">
                        <MoreVertical className="h-5 w-5 text-slate-400" />
                      </Button>
                    )} />
                    <DropdownMenuContent align="end" className="rounded-2xl p-2 border-slate-100 shadow-xl w-48">
                      <DropdownMenuItem className="rounded-xl font-bold text-slate-600 flex items-center gap-2 p-3 focus:bg-[#fd5523]/5 focus:text-[#fd5523] cursor-pointer">
                        <UserCheck className="h-4 w-4" /> View Performance
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-xl font-bold text-slate-600 flex items-center gap-2 p-3 focus:bg-[#fd5523]/5 focus:text-[#fd5523] cursor-pointer">
                        <Shield className="h-4 w-4" /> Change Permissions
                      </DropdownMenuItem>
                      
                      {groups.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="rounded-xl font-bold text-slate-600 flex items-center gap-2 p-3 focus:bg-[#fd5523]/5 focus:text-[#fd5523] cursor-pointer">
                            <UsersRound className="h-4 w-4" /> Assign to Group
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent className="rounded-2xl p-2 border-slate-100 shadow-xl min-w-[160px]">
                              {groups.map(group => (
                                <DropdownMenuItem 
                                  key={group.id}
                                  onClick={async () => {
                                    try {
                                      await addGroupMember(group.id, student.id, companyId, companySlug);
                                      toast.success(`Assigned to ${group.name}`);
                                    } catch (e: any) {
                                      toast.error(e.message);
                                    }
                                  }}
                                  className="rounded-xl font-bold text-slate-600 flex items-center p-3 focus:bg-[#fd5523]/5 focus:text-[#fd5523] cursor-pointer"
                                >
                                  {group.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}

                      <div className="h-px bg-slate-50 my-1" />
                      <DropdownMenuItem className="rounded-xl font-bold text-red-600 flex items-center gap-2 p-3 focus:bg-red-50 focus:text-red-700 cursor-pointer">
                        <Trash2 className="h-4 w-4" /> Remove from Academy
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            {filteredStudents.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6">
                   <Users className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-[#062e39]">No Students Found</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">
                  {searchQuery ? `No results for "${searchQuery}"` : "This academy doesn't have any students enrolled yet."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
