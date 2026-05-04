import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationBell } from "./notification-bell";

export async function NotificationBellServer() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  return <NotificationBell initialNotifications={notifications} initialUnread={unread} />;
}
