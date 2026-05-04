import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Account Settings | Student Dashboard",
};

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link 
              href="/dashboard" 
              className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-[#fd5523] transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#062e39]">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">Account Settings</h1>
            </div>
          </div>
        </div>

        {/* Clerk UserProfile Component */}
        <div className="marketing-shell rounded-[2.5rem] bg-white p-2 shadow-2xl overflow-hidden border border-slate-100">
          <UserProfile 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 w-full",
                navbar: "hidden sm:flex",
                scrollBox: "rounded-none",
                headerTitle: "text-2xl font-bold text-[#062e39]",
                headerSubtitle: "text-slate-500",
                profileSectionTitleText: "text-[#062e39] font-bold",
                userPreviewMainIdentifier: "text-[#062e39] font-bold",
                userPreviewSecondaryIdentifier: "text-slate-500",
                formButtonPrimary: "bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold rounded-xl",
                formFieldInput: "rounded-xl border-slate-200",
                badge: "bg-[#fff6ee] text-[#fd5523] font-bold border-0",
              }
            }}
            routing="hash"
          />
        </div>
      </div>
    </div>
  );
}
