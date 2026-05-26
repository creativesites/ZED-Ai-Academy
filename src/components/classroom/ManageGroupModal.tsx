"use client";

import { useState, useEffect, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, User, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { getGroupMembers, getCompanyStudents, addGroupMember, removeGroupMember } from "@/actions/classroom";

export function ManageGroupModal({ 
  group, 
  companyId, 
  companySlug 
}: { 
  group: any; 
  companyId: string; 
  companySlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  async function loadData() {
    setLoading(true);
    try {
      const [membersData, studentsData] = await Promise.all([
        getGroupMembers(group.id, companyId),
        getCompanyStudents(companyId)
      ]);
      setMembers(membersData);
      setAllStudents(studentsData);
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const memberIds = new Set(members.map(m => m.id));
  const availableStudents = allStudents.filter(s => !memberIds.has(s.id));

  function handleAdd(studentId: string) {
    startTransition(async () => {
      try {
        await addGroupMember(group.id, studentId, companyId, companySlug);
        toast.success("Student added to group");
        loadData();
      } catch (e: any) {
        toast.error(e.message || "Failed to add student");
      }
    });
  }

  function handleRemove(studentId: string) {
    startTransition(async () => {
      try {
        await removeGroupMember(group.id, studentId, companyId, companySlug);
        toast.success("Student removed from group");
        loadData();
      } catch (e: any) {
        toast.error(e.message || "Failed to remove student");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(props) => (
        <Button {...props} variant="outline" size="sm" className="rounded-lg text-xs font-bold h-8 border-slate-200 text-slate-600 hover:text-[#062e39]">
          Manage
        </Button>
      )} />
      <DialogContent className="rounded-3xl border-slate-100 p-0 overflow-hidden sm:max-w-xl max-h-[80vh] flex flex-col">
        <div className="p-6 bg-slate-50 border-b border-slate-100 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#062e39]">Manage {group.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-slate-500 mt-2">Add or remove students from this cohort.</p>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-white space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#fd5523]" />
              <p className="text-[10px] font-black uppercase tracking-widest">Loading Students...</p>
            </div>
          ) : (
            <>
              {/* Current Members */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                  <span>Current Members ({members.length})</span>
                </h4>
                {members.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-sm font-medium text-slate-400">
                    No members in this group yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#062e39]">{member.full_name || "Unknown Student"}</div>
                            <div className="text-xs font-medium text-slate-500">{member.email}</div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          disabled={pending}
                          onClick={() => handleRemove(member.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Students */}
              <div className="pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Available Students ({availableStudents.length})
                </h4>
                {availableStudents.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-sm font-medium text-slate-400">
                    All students are already in this group.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableStudents.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-slate-100/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#062e39]">{student.full_name || "Unknown Student"}</div>
                            <div className="text-xs font-medium text-slate-500">{student.email}</div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          disabled={pending}
                          onClick={() => handleAdd(student.id)}
                          className="h-8 w-8 text-slate-400 hover:text-[#fd5523] hover:bg-[#fd5523]/10 rounded-lg"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
