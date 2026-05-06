'use client';

import dynamic from "next/dynamic";

const Videochat = dynamic(() => import("./Videochat"), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-100 p-12">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Initializing Video Studio...</p>
      </div>
    </div>
  )
});

export default function VideochatClientWrapper() {
  return <Videochat />;
}