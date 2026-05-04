import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MessageSquare, Calendar, Mail, User, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Contact Entries — Admin" };

export default async function ContactEntriesPage() {
  const { userId } = await auth();
  const supabase = createServiceClient();

  if (userId) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (p?.role !== "super_admin") redirect("/dashboard");
  }

  const { data: entries, error } = await supabase
    .from("contact_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contact entries:", error);
  }

  return (
    <div className="container py-20">
      <div className="mb-12">
        <Link href="/admin" className="text-sm font-bold text-[#fd5523] hover:underline mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-4xl font-extrabold text-[#062e39] tracking-tight">Contact Entries</h1>
        <p className="text-slate-500 mt-2">Manage inquiries from the contact page.</p>
      </div>

      <div className="grid gap-6">
        {(!entries || entries.length === 0) ? (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <MessageSquare className="h-12 w-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No contact entries yet.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:border-[#fd5523]/20 transition-all group">
               <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
                  <div className="flex gap-4">
                     <div className="h-14 w-14 rounded-2xl bg-[#fff2e9] flex items-center justify-center text-[#fd5523] shrink-0 group-hover:scale-110 transition-transform">
                        <User className="h-6 w-6" />
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-[#062e39]">{entry.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                           <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                              <Mail className="h-3 w-3" />
                              {entry.email}
                           </div>
                           <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                              <Calendar className="h-3 w-3" />
                              {new Date(entry.created_at).toLocaleDateString("en-ZM", { dateStyle: "medium" })}
                           </div>
                        </div>
                     </div>
                  </div>
                  <Badge className={
                    entry.status === "new" ? "bg-blue-50 text-blue-600 border-0 uppercase text-[10px] tracking-widest" :
                    entry.status === "replied" ? "bg-green-50 text-green-600 border-0 uppercase text-[10px] tracking-widest" :
                    "bg-slate-50 text-slate-500 border-0 uppercase text-[10px] tracking-widest"
                  }>
                    {entry.status}
                  </Badge>
               </div>

               <div className="bg-slate-50 rounded-3xl p-6 mb-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Message Subject: {entry.subject || "No Subject"}</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{entry.message}</p>
               </div>

               <div className="flex items-center gap-3">
                  <Link 
                    href={`mailto:${entry.email}?subject=Re: ${entry.subject || "Zed AI Academy Inquiry"}`}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#062e39] text-white text-xs font-bold hover:bg-[#fd5523] transition-all"
                  >
                    <Mail className="h-4 w-4" />
                    Reply via Email
                  </Link>
                  <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200 transition-all">
                    Mark as Replied
                  </button>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
