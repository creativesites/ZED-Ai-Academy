export default function ClassroomLoading() {
  return (
    <div className="bg-slate-50 min-h-[100dvh] pt-20 sm:pt-24 pb-16 animate-pulse">
      <div className="container max-w-7xl px-3 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded-full bg-slate-200" />
            <div className="h-7 w-64 rounded-xl bg-slate-200" />
          </div>
        </div>

        {/* Sidebar + Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block w-72 shrink-0 bg-white rounded-[2.5rem] p-6 border border-slate-100 space-y-3 h-[520px]">
            <div className="h-10 rounded-xl bg-slate-100" />
            <div className="h-px bg-slate-100 my-3" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100" />
            ))}
          </div>

          <div className="flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 min-h-[600px] space-y-6">
            <div className="h-36 rounded-3xl bg-slate-100" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-28 rounded-2xl bg-slate-100" />
              <div className="h-28 rounded-2xl bg-slate-100" />
              <div className="h-28 rounded-2xl bg-slate-100" />
            </div>
            <div className="h-48 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
