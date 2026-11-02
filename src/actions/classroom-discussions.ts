"use server";

import { revalidatePath } from "next/cache";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";

export interface ClassroomChannel {
  id: string;
  company_id: string;
  cohort_id: string | null;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  cohort?: {
    id: string;
    name: string;
  } | null;
}

export interface MessageAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface ClassroomMessage {
  id: string;
  channel_id: string;
  company_id: string;
  user_id: string;
  content: string;
  attachments: MessageAttachment[];
  is_pinned: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role?: string;
  } | null;
}

const DEFAULT_CHANNELS = [
  {
    name: "general",
    display_name: "General Discussion",
    description: "Open lounge for all cohort members, questions and casual chat.",
    icon: "message-square",
    is_default: true,
  },
  {
    name: "homework-help",
    display_name: "Homework & Assignment Help",
    description: "Ask questions, share blockers, and collaborate on assignments.",
    icon: "help-circle",
    is_default: true,
  },
  {
    name: "project-showcase",
    display_name: "Project Showcase",
    description: "Share what you've built, show demos, and receive peer feedback.",
    icon: "sparkles",
    is_default: true,
  },
  {
    name: "resources",
    display_name: "Study Resources",
    description: "Useful articles, repositories, documentation, and cheat sheets.",
    icon: "book-open",
    is_default: true,
  },
];

export async function getClassroomChannels(
  companyId: string,
  cohortId?: string | null
): Promise<ClassroomChannel[]> {
  const { supabase } = await requireTenantMember(companyId);

  let query = supabase
    .from("classroom_channels")
    .select(`
      *,
      cohort:classroom_groups(id, name)
    `)
    .eq("company_id", companyId);

  if (cohortId && cohortId !== "all") {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  const { data, error } = await query.order("is_default", { ascending: false }).order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch channels error:", error);
    return [];
  }

  // Auto-seed default channels if this company has none yet
  if (!data || data.length === 0) {
    try {
      const inserts = DEFAULT_CHANNELS.map((ch) => ({
        company_id: companyId,
        cohort_id: null,
        name: ch.name,
        display_name: ch.display_name,
        description: ch.description,
        icon: ch.icon,
        is_default: ch.is_default,
      }));

      const { data: seeded, error: seedError } = await supabase
        .from("classroom_channels")
        .insert(inserts as any)
        .select(`*, cohort:classroom_groups(id, name)`);

      if (!seedError && seeded) {
        return seeded;
      }
    } catch (seedErr) {
      console.error("Auto-seed channels failed:", seedErr);
    }
  }

  return data ?? [];
}

export async function createClassroomChannel(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const { userId, supabase } = await requireTenantTeacher(companyId);

  const displayName = (formData.get("displayName") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const cohortIdRaw = formData.get("cohortId") as string;
  const cohortId = cohortIdRaw && cohortIdRaw !== "all" ? cohortIdRaw : null;

  if (!displayName) throw new Error("Channel name is required.");

  const name = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: channel, error } = await supabase
    .from("classroom_channels")
    .insert({
      company_id: companyId,
      cohort_id: cohortId,
      name,
      display_name: displayName,
      description,
      icon: "hash",
      is_default: false,
      created_by: userId,
    } as any)
    .select(`*, cohort:classroom_groups(id, name)`)
    .single();

  if (error) {
    console.error("Create channel error:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true, channel };
}

export async function getClassroomMessages(
  channelId: string,
  companyId: string,
  limit: number = 100
): Promise<ClassroomMessage[]> {
  const { supabase } = await requireTenantMember(companyId);

  const { data, error } = await supabase
    .from("classroom_messages")
    .select(`
      *,
      user:profiles!classroom_messages_user_id_fkey(id, full_name, avatar_url, role)
    `)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Fetch messages error:", error);
    return [];
  }

  return (data ?? []).map((msg: any) => ({
    ...msg,
    attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
  }));
}

export async function postClassroomMessage(formData: FormData) {
  const companyId = formData.get("companyId") as string;
  const companySlug = formData.get("companySlug") as string;
  const channelId = formData.get("channelId") as string;
  const content = (formData.get("content") as string)?.trim();

  const { userId, supabase } = await requireTenantMember(companyId);

  if (!channelId) throw new Error("Channel ID is required.");

  const attachments: MessageAttachment[] = [];
  const file = formData.get("file") as File | null;

  if (file && file.size > 0) {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${companyId}/discussions/${channelId}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("classroom-materials")
      .upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload discussion attachment:", uploadError);
      throw new Error(`Attachment upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("classroom-materials")
      .getPublicUrl(filePath);

    attachments.push({
      name: file.name,
      url: publicUrlData.publicUrl,
      size: file.size,
      type: file.type,
    });
  }

  if (!content && attachments.length === 0) {
    throw new Error("Message cannot be empty.");
  }

  const { data: newMsg, error } = await supabase
    .from("classroom_messages")
    .insert({
      channel_id: channelId,
      company_id: companyId,
      user_id: userId,
      content: content || (attachments.length > 0 ? `Shared file: ${attachments[0].name}` : ""),
      attachments: attachments as any,
      is_pinned: false,
    } as any)
    .select(`
      *,
      user:profiles!classroom_messages_user_id_fkey(id, full_name, avatar_url, role)
    `)
    .single();

  if (error) {
    console.error("Post message error:", error);
    throw new Error(error.message);
  }

  return { success: true, message: newMsg };
}

export async function deleteClassroomMessage(
  messageId: string,
  companyId: string
) {
  const { userId, tenantRole, isSuperAdmin, supabase } = await requireTenantMember(companyId);
  const isPrivileged =
    isSuperAdmin ||
    tenantRole === "company_admin" ||
    tenantRole === "teacher" ||
    tenantRole === "instructor";

  let query = supabase.from("classroom_messages").delete().eq("id", messageId);
  if (!isPrivileged) {
    query = query.eq("user_id", userId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);

  return { success: true };
}

export async function togglePinClassroomMessage(
  messageId: string,
  companyId: string,
  isPinned: boolean
) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { error } = await supabase
    .from("classroom_messages")
    .update({ is_pinned: isPinned } as any)
    .eq("id", messageId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  return { success: true };
}

// Backward compatibility helper for legacy caller
export async function getClassroomDiscussions(companyId: string) {
  const channels = await getClassroomChannels(companyId);
  if (channels.length === 0) return [];
  return getClassroomMessages(channels[0].id, companyId);
}

export async function postClassroomDiscussion(
  companyId: string,
  companySlug: string,
  content: string
) {
  const channels = await getClassroomChannels(companyId);
  if (channels.length === 0) throw new Error("No channels available.");

  const formData = new FormData();
  formData.append("companyId", companyId);
  formData.append("companySlug", companySlug);
  formData.append("channelId", channels[0].id);
  formData.append("content", content);

  return postClassroomMessage(formData);
}
