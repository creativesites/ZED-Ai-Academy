import { redirect } from "next/navigation";

export default async function LegacyAdminSettingsLiveSessionsRedirect({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  redirect(`/academy/${domain}/admin/live-sessions`);
}
