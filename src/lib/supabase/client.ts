import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Thin unauthenticated client for public client-side reads.
// For mutations, use server actions (which carry the Clerk JWT server-side).
let client: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export const createClient = () => {
  if (typeof window === "undefined") {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    );
  }

  if (!client) {
    client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
};
