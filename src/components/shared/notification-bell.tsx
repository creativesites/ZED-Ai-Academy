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
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: "8px", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#062e39", transition: "background 0.15s",
        }}
      >
        <Bell style={{ width: "22px", height: "22px" }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "4px", right: "4px",
            background: "#fd5523", color: "#fff", borderRadius: "50%",
            width: "16px", height: "16px", fontSize: "10px",
            fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
          />

          {/* Dropdown */}
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: "340px", maxHeight: "480px", overflowY: "auto",
            background: "#fff", border: "1px solid #f0f0f0",
            borderRadius: "20px", boxShadow: "0 20px 60px rgba(6,46,57,0.12)",
            zIndex: 1000,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid #f5f5f5",
            }}>
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
