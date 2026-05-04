"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LayoutDashboard, BookOpen, LogOut, Settings } from "lucide-react";

export function UserNav({ user }: { user: User }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = user.email?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        aria-label="User menu"
      >
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarFallback className="bg-violet-600 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-popover border-border text-popover-foreground"
      >
        <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          render={<Link href="/dashboard" />}
          className="flex items-center gap-2 cursor-pointer hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href="/dashboard" />}
          className="flex items-center gap-2 cursor-pointer hover:bg-muted"
        >
          <BookOpen className="h-4 w-4" />
          My Courses
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href="/dashboard/settings" />}
          className="flex items-center gap-2 cursor-pointer hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center gap-2 cursor-pointer text-red-600 hover:bg-muted hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
