"use client";

import { useState, useEffect } from "react";
import { UsersRound, Plus, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getClassroomGroups, createClassroomGroup } from "@/actions/classroom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function GroupsTab({ companyId }: { companyId: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getClassroomGroups(companyId);
        setGroups(data);
      } catch (e) {
        toast.error("Failed to load groups");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function handleCreateGroup(formData: FormData) {
    try {
      formData.append("companyId", companyId);
      formData.append("companySlug", "placeholder"); // Normally we'd pass slug
      await createClassroomGroup(formData);
      toast.success("Group created!");
      setOpen(false);
      // Reload groups
      const data = await getClassroomGroups(companyId);
      setGroups(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50/30">
      <div className="p-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-[#062e39] tracking-tight flex items-center gap-3">
              Class Groups
              <UsersRound className="h-7 w-7 text-[#fd5523]" />
            </h2>
            <p className="text-slate-500 font-medium mt-1">Organize students into classes or cohorts.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={(props) => (
              <Button {...props} className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-2xl h-12 px-6 font-black text-sm uppercase tracking-widest shadow-xl shadow-[#fd5523]/20 transition-all hover:scale-[1.02] flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Group
              </Button>
            )} />
            <DialogContent className="rounded-3xl border-slate-100 p-0 overflow-hidden sm:max-w-md">
              <div className="p-6 bg-slate-50 border-b border-slate-100">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-[#062e39]">Create New Group</DialogTitle>
                </DialogHeader>
              </div>
              <form action={handleCreateGroup} className="p-6 space-y-4 bg-white">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Group Name</label>
                  <Input name="name" required placeholder="e.g. Fall 2026 Cohort" className="h-12 rounded-xl border-slate-200 focus:ring-[#fd5523]/10 focus:border-[#fd5523]/30 font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Description</label>
                  <Textarea name="description" placeholder="Optional details about this group" className="rounded-xl border-slate-200 focus:ring-[#fd5523]/10 focus:border-[#fd5523]/30 font-medium min-h-[100px]" />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl bg-[#062e39] text-white hover:bg-[#0a4a5c] font-black uppercase tracking-widest text-xs">
                  Create Group
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#fd5523]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Loading Groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6">
              <UsersRound className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-[#062e39]">No Groups Yet</h3>
            <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">
              Create a group to organize students into classes or cohorts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div key={group.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-xl bg-[#fd5523]/10 flex items-center justify-center text-[#fd5523]">
                      <UsersRound className="h-6 w-6" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] mb-1">{group.name}</h3>
                  <p className="text-sm font-medium text-slate-500 line-clamp-2">{group.description || "No description provided."}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Info className="h-4 w-4" /> 0 Students
                  </span>
                  <Button variant="outline" size="sm" className="rounded-lg text-xs font-bold h-8 border-slate-200 text-slate-600 hover:text-[#062e39]">
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
