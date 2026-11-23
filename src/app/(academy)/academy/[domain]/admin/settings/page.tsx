import { redirect } from "next/navigation";

export default async function LegacyAdminSettingsRedirect({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  redirect(`/academy/${domain}/admin/settings/site`);
}
