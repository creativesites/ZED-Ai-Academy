"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function getNotifications() {
  const { userId } = await auth();
  if (!userId) return { notifications: [], unread: 0 };

  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  return { notifications, unread };
}

export async function markAllRead() {
  const { userId } = await auth();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export async function markRead(notificationId: string) {
  const { userId } = await auth();
  if (!userId) return;

  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

// Called from server-side code (enrollments, certificates, etc.)
export async function insertNotification({
  userId,
  type,
  title,
  body,
  data,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    data: (data ?? {}) as import("@/types/database").Json,
  });
}
