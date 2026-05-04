import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// One-time backfill: pulls all users from Clerk and upserts them into profiles.
// Protected by ADMIN_SYNC_SECRET env var — set it to any strong random string.
// Call once: GET /api/admin/sync-clerk-users?secret=<ADMIN_SYNC_SECRET>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.ADMIN_SYNC_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return Response.json({ error: "CLERK_SECRET_KEY not set" }, { status: 500 });
  }

  // Fetch all users from Clerk Backend API (paginated, up to 500)
  const res = await fetch("https://api.clerk.com/v1/users?limit=500", {
    headers: { Authorization: `Bearer ${clerkSecretKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: `Clerk API error: ${text}` }, { status: 500 });
  }

  const clerkUsers = await res.json() as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string | null;
  }>;

  const supabase = createServiceClient();

  const rows = clerkUsers.map((u) => {
    const primaryEmail =
      u.email_addresses.find((e) => e.id === u.primary_email_address_id)
        ?.email_address ?? null;
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;

    return {
      id: u.id,
      full_name: fullName,
      avatar_url: u.image_url,
      email: primaryEmail,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("profiles")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ synced: rows.length, users: rows.map((r) => r.email) });
}
