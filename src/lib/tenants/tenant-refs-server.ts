import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import {
  assertRefsInTenant,
  createSupabaseRefLookup,
  TenantRefError,
  type TenantRefs,
} from "@/lib/tenants/tenant-refs";

/** Throws a {@link TenantRefError} when any id in `refs` belongs to another tenant. */
export async function assertTenantRefs(companyId: string, refs: TenantRefs): Promise<void> {
  const lookup = createSupabaseRefLookup(
    createServiceClient() as unknown as Parameters<typeof createSupabaseRefLookup>[0],
  );
  await assertRefsInTenant(lookup, companyId, refs, ZEDAI_TENANT_ID);
}

/** Route helper: 403 JSON for a tenant reference violation, or null when the error is something else. */
export function tenantRefErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof TenantRefError) {
    return NextResponse.json({ error: err.message, reason: "tenant_ref_mismatch" }, { status: 403 });
  }
  return null;
}
