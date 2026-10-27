import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { PracticeLibraryItem } from "../practice-library.ts";
import { startableModes } from "../practice-library.ts";
import type { Mode, SkillPack } from "../scenario.ts";

// The scenarios a learner may see in the Practice Room. The service client bypasses RLS, so the
// visibility rules are applied here, from the verified Clerk user id:
// - tenant_library scenarios of the learner's active tenants (or of one tenant, on a tenant page),
//   skipped for tenants that turned the Practice Room off;
// - platform scenarios, which any signed-in learner can use.

export type PracticeLibraryScope = { kind: "platform" } | { kind: "tenant"; companyId: string };

export type PracticeLibraryResult =
  | { ok: true; items: PracticeLibraryItem[] }
  | { ok: false; reason: "not_tenant_member" };

const SCENARIO_COLUMNS =
  "id, company_id, title, goal, skill_pack, level, max_minutes, allowed_modes, visibility, persona_id";

export async function loadPracticeLibrary(userId: string, scope: PracticeLibraryScope): Promise<PracticeLibraryResult> {
  const supabase = createServiceClient();

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("status", "active");
  const memberOf = new Set((memberships ?? []).map((m) => m.company_id));

  if (scope.kind === "tenant" && !memberOf.has(scope.companyId)) {
    return { ok: false, reason: "not_tenant_member" };
  }

  const tenantIds = scope.kind === "tenant" ? [scope.companyId] : [...memberOf];
  const { data: settings } = tenantIds.length
    ? await supabase
        .from("tutor_settings")
        .select("company_id, practice_room_enabled")
        .in("company_id", tenantIds)
    : { data: [] };
  const disabled = new Set((settings ?? []).filter((s) => !s.practice_room_enabled).map((s) => s.company_id));
  const enabledTenants = tenantIds.filter((id) => !disabled.has(id));

  const [libraryRes, platformRes] = await Promise.all([
    enabledTenants.length
      ? supabase
          .from("practice_scenarios")
          .select(SCENARIO_COLUMNS)
          .eq("status", "published")
          .eq("visibility", "tenant_library")
          .in("company_id", enabledTenants)
      : Promise.resolve({ data: [] as ScenarioRow[] }),
    scope.kind === "platform" || enabledTenants.length
      ? supabase
          .from("practice_scenarios")
          .select(SCENARIO_COLUMNS)
          .eq("status", "published")
          .eq("visibility", "platform")
      : Promise.resolve({ data: [] as ScenarioRow[] }),
  ]);

  const rows = [...(libraryRes.data ?? []), ...(platformRes.data ?? [])] as ScenarioRow[];
  const personaIds = [...new Set(rows.map((r) => r.persona_id).filter((id): id is string => !!id))];
  const { data: personas } = personaIds.length
    ? await supabase.from("ai_personas").select("id, name, display_name").in("id", personaIds)
    : { data: [] };
  const personaName = new Map((personas ?? []).map((p) => [p.id, p.display_name ?? p.name]));

  const items: PracticeLibraryItem[] = rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      goal: row.goal,
      skillPack: row.skill_pack as SkillPack,
      level: row.level,
      maxMinutes: row.max_minutes,
      allowedModes: row.allowed_modes as Mode[],
      visibility: row.visibility as "tenant_library" | "platform",
      personaName: row.persona_id ? personaName.get(row.persona_id) ?? null : null,
    }))
    // Scenarios that only allow live cannot start yet, so they are not offered.
    .filter((item) => startableModes(item.allowedModes).length > 0);

  return { ok: true, items };
}

/** One scenario from the learner's library, or null when they may not see it. */
export async function findPracticeScenario(
  userId: string,
  scenarioId: string,
  scope: PracticeLibraryScope,
): Promise<PracticeLibraryItem | null> {
  const result = await loadPracticeLibrary(userId, scope);
  if (!result.ok) return null;
  return result.items.find((item) => item.id === scenarioId) ?? null;
}

type ScenarioRow = {
  id: string;
  company_id: string;
  title: string;
  goal: string;
  skill_pack: string;
  level: string | null;
  max_minutes: number;
  allowed_modes: string[];
  visibility: string;
  persona_id: string | null;
};
