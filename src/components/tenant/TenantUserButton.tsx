"use client";

import { UserButton, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export function TenantUserButton({
  tenantSlug,
  afterSignOutUrl,
}: {
  tenantSlug?: string;
  afterSignOutUrl?: string;
}) {
  const { signOut } = useClerk();
  const targetUrl = afterSignOutUrl || (tenantSlug ? `/academy/${tenantSlug}` : "/");

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label="Sign Out"
          labelIcon={<LogOut className="h-4 w-4 text-slate-400" />}
          onClick={() => signOut({ redirectUrl: targetUrl })}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
