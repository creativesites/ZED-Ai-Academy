import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Thin unauthenticated client for public client-side reads.
// For mutations or authenticated reads, provide the Clerk JWT.
let unauthenticatedClient: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export const createClient = (clerkToken?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  // If a token is provided, return a fresh authenticated client.
  if (clerkToken) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${clerkToken}`,
        },
      },
      auth: {
        persistSession: false,
      },
    });
  }

  // Server-side unauthenticated client (no window)
  if (typeof window === "undefined") {
    return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  // Client-side singleton unauthenticated client
  if (!unauthenticatedClient) {
    unauthenticatedClient = createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  
  return unauthenticatedClient;
};
