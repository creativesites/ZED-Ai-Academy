import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Building2, BookOpen, ArrowRight, PlusCircle, Sparkles, ShieldCheck } from "lucide-react";

export default async function AcademiesSection() {
  const supabase = createClient();

  // Fetch all active academies
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, created_at, status")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const companyIds = (companies ?? []).map((c) => c.id);

  // Fetch course counts per company
  const { data: courseRows } = companyIds.length > 0
    ? await supabase.from("courses").select("company_id").in("company_id", companyIds)
    : { data: [] };

  const courseCountsMap = new Map<string, number>();
  (courseRows ?? []).forEach((c) => {
    if (c.company_id) {
      courseCountsMap.set(c.company_id, (courseCountsMap.get(c.company_id) ?? 0) + 1);
    }
  });

  if (!companies || companies.length === 0) return null;

  return (
    <section id="academies" className="py-24 bg-slate-50/80 border-t border-b border-slate-200/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 text-[#fd5523] border border-orange-200/60 text-xs font-black uppercase tracking-wider mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Multi-Tenant Network</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight uppercase">
            Featured <span className="text-[#fd5523]">Academies</span>
          </h2>
          <p className="mt-4 text-slate-600 text-sm sm:text-base leading-relaxed">
            Explore independent AI learning portals and teaching studios powered by Zed AI Academy. 
            Each academy features custom curricula, certified instructors, and dedicated classrooms.
          </p>
        </div>

        {/* Academies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {companies.map((tenant) => {
            const courseCount = courseCountsMap.get(tenant.id) ?? 0;
            const brandColor = tenant.primary_color || "#fd5523";
            const isPlatform = tenant.slug === "zedai";

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-[2rem] border border-slate-200/80 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  {/* Top Branding / Logo */}
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0"
                      style={{ backgroundColor: brandColor }}
                    >
                      {tenant.logo_url ? (
                        <img
                          src={tenant.logo_url}
                          alt={tenant.name}
                          className="h-full w-full object-cover rounded-2xl"
                        />
                      ) : (
                        tenant.name.charAt(0)
                      )}
                    </div>

                    {isPlatform && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                        Platform Core
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-[#fd5523] transition-colors">
                    {tenant.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    /{tenant.slug}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span>{courseCount} published course(s)</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    href={`/academy/${tenant.slug}`}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <span>Visit Academy</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Launch Your Own Academy CTA Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-[2rem] p-6 shadow-xl flex flex-col justify-between border border-slate-700/60 group hover:-translate-y-1 transition-all">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-white/10 text-[#fd5523] flex items-center justify-center mb-5 border border-white/10">
                <PlusCircle className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-black text-white tracking-tight">
                Your Academy Here
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Start teaching under your own brand today with customizable themes, live video integration, and AI tutoring.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <Link
                href="/launch-your-academy"
                className="w-full flex items-center justify-center gap-2 bg-[#fd5523] hover:bg-[#ea4817] text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-lg shadow-[#fd5523]/30 transition-all hover:scale-105 active:scale-95"
              >
                <span>Launch Academy</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
