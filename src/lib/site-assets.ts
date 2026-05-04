import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export async function getSiteAsset(key: string, defaultValue: string): Promise<string> {
  // Try to use the service client for server-side calls if possible, 
  // but this is generic enough to work on either side if we use the right client creator.
  
  // For simplicity in this implementation, we'll assume this is mostly called on the server 
  // or that RLS allows public select on site_assets (which we set up in the migration).
  
  const isServer = typeof window === 'undefined';
  const supabase = isServer ? createServiceClient() : createClient();

  const { data } = await supabase
    .from("site_assets")
    .select("url")
    .eq("key", key)
    .single();

  return data?.url || defaultValue;
}

export async function getSiteAssets(keys: string[]): Promise<Record<string, string>> {
  const isServer = typeof window === 'undefined';
  const supabase = isServer ? createServiceClient() : createClient();

  const { data } = await supabase
    .from("site_assets")
    .select("key, url")
    .in("key", keys);

  const result: Record<string, string> = {};
  data?.forEach(item => {
    result[item.key] = item.url;
  });
  return result;
}
