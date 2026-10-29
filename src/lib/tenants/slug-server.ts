import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { baseAcademySlug, pickAvailableSlug } from "@/lib/tenants/slug";

/**
 * A free, non-reserved companies.slug for `name`. `excludeId` is the academy being
 * (re)named, so its own current slug does not count as taken.
 */
export async function generateAcademySlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = baseAcademySlug(name);
  const { data, error } = await supabase
    .from("companies")
    .select("id, slug")
    .like("slug", `${base}%`)
    .limit(1000);
  if (error) throw new Error(error.message);

  const taken = ((data ?? []) as { id: string; slug: string }[])
    .filter((row) => row.id !== excludeId)
    .map((row) => row.slug);
  return pickAvailableSlug(name, taken);
}
