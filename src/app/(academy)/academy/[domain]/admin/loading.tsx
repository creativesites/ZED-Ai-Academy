export default function AcademyAdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="h-8 w-56 rounded-xl bg-slate-200" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200/80 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="h-7 w-16 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-3xl bg-white border border-slate-200/80" />
          <div className="h-80 rounded-3xl bg-white border border-slate-200/80" />
        </div>
      </div>
    </div>
  );
}
