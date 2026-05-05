import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { sessionClaims } = await auth();
  
  if (sessionClaims?.metadata?.onboardingComplete === true) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
        <div className="bg-[#062e39] p-8 text-white">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#fd5523] mb-2">Welcome to the Academy</p>
          <h1 className="text-3xl font-bold tracking-tight">Let's set up your profile</h1>
        </div>
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
