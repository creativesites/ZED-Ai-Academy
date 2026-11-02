"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createAuthedClient } from "@/lib/supabase/client";

/**
 * Supabase client bound to the current Clerk session. Re-created only when the
 * session object changes, so subscriptions are not torn down on every render.
 */
export function useSupabase() {
  const { session } = useSession();
  return useMemo(
    () => createAuthedClient(() => session?.getToken() ?? Promise.resolve(null)),
    [session]
  );
}
