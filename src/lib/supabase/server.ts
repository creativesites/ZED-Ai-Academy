import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client for all server-side code.
// Authorization is enforced at the application layer via Clerk auth() before any
// DB call — so bypassing RLS here is safe and avoids needing a Clerk JWT template.
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
