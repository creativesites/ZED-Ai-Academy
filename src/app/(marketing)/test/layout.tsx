import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TestSandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    const { userId } = await auth();
    if (!userId) notFound();

    const service = createServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role !== "super_admin") {
      notFound();
    }
  }

  return <>{children}</>;
}
