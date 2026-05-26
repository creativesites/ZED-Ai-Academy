"use client";

import { useState, useTransition } from "react";
import { Bell, BookOpen, Award, Sparkles, X } from "lucide-react";
import { getNotifications, markAllRead, markRead } from "@/actions/notifications";
import type { Notification } from "@/types/database";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  enrollment: BookOpen,
  certificate: Award,
  course_update: Sparkles,
  default: Bell,
};

function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function NotificationBell({ initialNotifications, initialUnread }: {
  initialNotifications: Notification[];
  initialUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();

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
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center p-2 rounded-full text-[#062e39] hover:bg-[#fff6ee] transition-colors cursor-pointer border-none bg-none"
      >
        <Bell className="w-[22px] h-[22px]" />
        {unread > 0 && (
          <span className="absolute top-[4px] right-[4px] bg-[#fd5523] text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[99]"
          />

          {/* Dropdown */}
          <div className="absolute right-[-32px] sm:right-0 top-[calc(100%+8px)] w-[290px] xs:w-[340px] max-h-[480px] overflow-y-auto bg-white border border-slate-100 rounded-[20px] shadow-[0_20px_60px_rgba(6,46,57,0.15)] z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <p style={{ fontWeight: 700, color: "#062e39", fontSize: "14px", margin: 0 }}>Notifications</p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={refresh}
                  style={{ background: "none", border: "none", fontSize: "12px", color: "#fd5523", fontWeight: 600, cursor: "pointer" }}
                >
                  Refresh
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#999", display: "flex" }}
                >
                  <X style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#bbb" }}>
                <Bell style={{ width: "28px", height: "28px", margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: "14px", margin: 0 }}>No notifications yet.</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const Icon = ICONS[n.type] ?? ICONS.default;
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex", gap: "12px", padding: "14px 20px",
                        borderBottom: "1px solid #f9f9f9",
                        background: n.read ? "#fff" : "#fffbf8",
                        cursor: "default",
                      }}
                    >
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "12px",
                        background: "#fff2e9", display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0, color: "#fd5523",
                      }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: n.read ? 500 : 700, color: "#062e39", fontSize: "13px", margin: "0 0 3px" }}>
                          {n.title}
                        </p>
                        {n.body && <p style={{ color: "#888", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>{n.body}</p>}
                        <p style={{ color: "#bbb", fontSize: "11px", margin: "4px 0 0" }}>{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.read && (
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fd5523", flexShrink: 0, marginTop: "4px" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
