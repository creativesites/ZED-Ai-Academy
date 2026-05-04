"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Post a new comment on a blog post.
 * Logged-in users auto-resolve name/email from Clerk.
 * Guest users must provide name & email manually.
 */
export async function postComment(
  postId: string,
  content: string,
  parentId?: string,
  guestName?: string,
  guestEmail?: string
) {
  const { userId } = await auth();
  const supabase = createClient();

  // For logged-in users, pull their name from Clerk so the comment
  // is attributed properly even if name/email fields are hidden.
  let resolvedName = guestName || null;
  let resolvedEmail = guestEmail || null;

  if (userId) {
    const user = await currentUser();
    resolvedName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
    resolvedEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  }

  // Content validation
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length < 3) throw new Error("Comment is too short.");
  if (trimmed.length > 2000) throw new Error("Comment is too long (max 2000 characters).");

  // Guest validation
  if (!userId) {
    if (!resolvedName || resolvedName.trim().length < 2)
      throw new Error("Please enter your name.");
    if (!resolvedEmail || !resolvedEmail.includes("@"))
      throw new Error("Please enter a valid email address.");
  }

  const { error } = await supabase.from("blog_comments").insert({
    post_id: postId,
    user_id: userId || null,
    name: resolvedName,
    email: resolvedEmail,
    content: trimmed,
    parent_id: parentId || null,
  });

  if (error) {
    console.error("Error posting comment:", error);
    throw new Error("Failed to post comment. Please try again.");
  }

  return { success: true };
}

/**
 * Fetch all comments for a blog post, including nested profile data.
 */
export async function getComments(postId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("blog_comments")
    .select(
      `
      *,
      profiles:user_id (full_name, avatar_url)
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  return data;
}

/**
 * Delete a comment. Only the comment author can delete their own comment.
 */
export async function deleteComment(commentId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in to delete a comment.");

  const supabase = createClient();

  const { error } = await supabase
    .from("blog_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting comment:", error);
    throw new Error("Failed to delete comment.");
  }

  return { success: true };
}

/**
 * Get comment count for a given post slug (used on blog listing).
 */
export async function getCommentCount(postId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("blog_comments")
    .select("*", { head: true, count: "exact" })
    .eq("post_id", postId);

  if (error) return 0;
  return count ?? 0;
}
