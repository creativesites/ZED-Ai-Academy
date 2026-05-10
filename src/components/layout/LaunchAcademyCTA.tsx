"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Rocket } from "lucide-react";
import { useProfileNav } from "@/hooks/use-profile-nav";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "header" | "mobileMenu";
};

export function LaunchAcademyCTA({ className, variant = "header" }: Props) {
  const { isSignedIn } = useAuth();
  const { loaded, needsAcademyLaunch } = useProfileNav();

  if (!isSignedIn || !loaded || !needsAcademyLaunch) return null;

  if (variant === "mobileMenu") {
    return (
      <Link
        href="/launch-your-academy"
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#fd5523] to-[#ff7a45] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-[#fd5523]/25",
          className
        )}
      >
        <Rocket className="h-5 w-5" />
        Open your academy
      </Link>
    );
  }

  return (
    <Link
      href="/launch-your-academy"
      className={cn(
        "flex items-center gap-2 rounded-full border border-[#fd5523]/30 bg-[#fd5523]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#fd5523] transition-all hover:bg-[#fd5523] hover:text-white",
        className
      )}
    >
      <Rocket className="h-3 w-3" />
      Open your academy
    </Link>
  );
}
