import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client for all server-side code. ⚠️ This BYPASSES Row Level Security:
// every caller must authorize the user (Clerk auth() + tenant/course checks) before touching
// data. `server-only` makes any accidental import into client code a build error.
export const createClient = () =>
  createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

/** Service-role client for server-to-server operations (webhooks, etc.) */
export const createServiceClient = () =>
  createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
