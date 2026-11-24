export default function AcademyLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Header skeleton */}
      <div className="h-16 border-b border-slate-100 px-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-200" />
          <div className="h-4 w-36 rounded-lg bg-slate-200" />
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <div className="h-3 w-16 rounded bg-slate-100" />
          <div className="h-3 w-16 rounded bg-slate-100" />
          <div className="h-9 w-24 rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-20 space-y-6">
        <div className="h-5 w-32 rounded-full bg-slate-100" />
        <div className="h-12 w-3/4 max-w-2xl rounded-2xl bg-slate-200" />
        <div className="h-4 w-2/3 max-w-xl rounded-lg bg-slate-100" />
        <div className="flex gap-3 pt-4">
          <div className="h-12 w-36 rounded-2xl bg-slate-200" />
          <div className="h-12 w-32 rounded-2xl bg-slate-100" />
        </div>
      </div>

      {/* Course cards grid skeleton */}
      <div className="max-w-7xl mx-auto px-6 pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-3xl border border-slate-100 overflow-hidden bg-white">
            <div className="aspect-video bg-slate-100" />
            <div className="p-5 space-y-3">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
