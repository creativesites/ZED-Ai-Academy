"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Award,
  Sparkles,
  Video,
  Clock,
  Calendar,
  X,
  Megaphone,
  FileCheck2,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { getNotifications, markAllRead } from "@/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  enrollment: BookOpen,
  certificate: Award,
  course_update: Sparkles,
  live_session: Video,
  live_session_reminder: Clock,
  class_schedule: Calendar,
  announcement: Megaphone,
  assignment: FileCheck2,
  default: Bell,
};

function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function NotificationBell({
  initialNotifications,
  initialUnread,
}: {
  initialNotifications?: Notification[];
  initialUnread?: number;
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications ?? []
  );
  const [unread, setUnread] = useState<number>(initialUnread ?? 0);
  const [, startTransition] = useTransition();

  // Auto-load on mount when rendered inside client navbars without SSR props
  useEffect(() => {
    if (initialNotifications !== undefined) return;
    let active = true;
    getNotifications()
      .then(({ notifications: fresh, unread: u }) => {
        if (!active) return;
        setNotifications(fresh);
        setUnread(u);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [initialNotifications]);

  // Real-time Supabase subscription for instant incoming notifications
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification;
          if (!incoming?.id) return;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 30);
          });
          if (!incoming.read) {
            setUnread((u) => u + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function toggle() {
    if (!open && unread > 0) {
      startTransition(async () => {
        await markAllRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
      });
    }
    setOpen((v) => !v);
  }

  async function refresh() {
    const { notifications: fresh, unread: u } = await getNotifications();
    setNotifications(fresh);
    setUnread(u);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center p-2 rounded-full text-[#062e39] hover:bg-[#fff6ee] transition-colors cursor-pointer border-none bg-transparent"
      >
        <Bell className="w-[20px] h-[20px]" />
        {unread > 0 && (
          <span className="absolute top-[3px] right-[3px] bg-[#fd5523] text-white rounded-full min-w-[16px] h-4 px-1 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-[99]" />

          <div className="absolute right-[-32px] sm:right-0 top-[calc(100%+8px)] w-[300px] sm:w-[350px] max-h-[480px] overflow-y-auto bg-white border border-slate-200/80 rounded-2xl shadow-[0_20px_60px_rgba(6,46,57,0.16)] z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
              <p className="font-bold text-[#062e39] text-sm m-0">Notifications</p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={refresh}
                  className="text-xs font-bold text-[#fd5523] hover:underline cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="py-10 px-5 text-center text-slate-400">
                <Bell className="w-7 h-7 mx-auto mb-2.5 opacity-40" />
                <p className="text-xs font-medium m-0">You&apos;re all caught up.</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const Icon = ICONS[n.type] ?? ICONS.default;
                  const dataObj = (n.data || {}) as Record<string, any>;
                  const targetUrl =
                    dataObj.url ||
                    (dataObj.company_slug
                      ? `/academy/${dataObj.company_slug}/classroom`
                      : null);

                  const row = (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3.5 border-b border-slate-50 transition-colors ${
                        n.read ? "bg-white" : "bg-[#fffaf6]"
                      } ${targetUrl ? "hover:bg-slate-50 cursor-pointer" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#fff2e9] text-[#fd5523] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs text-[#062e39] m-0 mb-0.5 leading-snug ${
                            n.read ? "font-semibold" : "font-bold"
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11px] text-slate-500 m-0 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 m-0 mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#fd5523] shrink-0 mt-1.5" />
                      )}
                    </div>
                  );

                  if (targetUrl) {
                    return (
                      <Link
                        key={n.id}
                        href={targetUrl}
                        onClick={() => setOpen(false)}
                        className="block"
                      >
                        {row}
                      </Link>
                    );
                  }

                  return row;
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
