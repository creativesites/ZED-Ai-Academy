"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Academies", href: "/#academies" },
  { label: "Pricing", href: "/pricing" },
  { label: "AI Tutor", href: "/ai-tutor" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Menu() {
  const pathname = usePathname();

  return (
    <ul className="hidden lg:flex items-center gap-1">
      {LINKS.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : link.href !== "/#academies" && pathname.startsWith(link.href);

        return (
          <li key={link.label}>
            <Link
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors",
                isActive
                  ? "bg-[#fff6ee] text-[#fd5523] font-bold"
                  : "text-slate-600 hover:text-[#062e39] hover:bg-slate-100/70"
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
