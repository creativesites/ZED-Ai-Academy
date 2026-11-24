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

  //   console.log('LaunchAcademyCTA - loaded', loaded)
  // console.log('LaunchAcademyCTA - needsAcademyLaunch', needsAcademyLaunch)

  if (!isSignedIn || !loaded || !needsAcademyLaunch) return null;

  if (variant === "mobileMenu") {
    return (
      <Link
        href="/launch-your-academy"

      >
        <button
          className="relative flex h-9 w-44 rounded-lg items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:bg-gray-700"
          style={{ borderRadius: '12px' }}
        >

          <span className="relative z-10" style={{ fontSize: '10px' }}>Launch Your Academy</span>
          <svg
            className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
            data-slot="icon"
            aria-hidden="true"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clipRule="evenodd"
              d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
              fillRule="evenodd"
            />
          </svg>
        </button>
      </Link>
    );
  }

  return (
    <Link
      href="/launch-your-academy"

    >
      <button
        className="relative flex h-11 w-46 rounded-lg items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:bg-gray-700"
        style={{ borderRadius: '12px' }}
      >

        <span className="relative z-10" style={{ fontSize: '12px' }}>Launch Your Academy</span>
        <svg
          className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          data-slot="icon"
          aria-hidden="true"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            clipRule="evenodd"
            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
            fillRule="evenodd"
          />
        </svg>
      </button>
    </Link>
  );
}
