import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isTenantStaffRole, tenantRole } from "../../authz/policy.ts";
import type { PracticeLibraryItem } from "../practice-library.ts";
import { startableModes } from "../practice-library.ts";
import type { Mode, SkillPack } from "../scenario.ts";
import { personaLookFromVariant, sceneFromValue } from "../tutor-session-block.ts";

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
  "id, company_id, title, goal, skill_pack, level, max_minutes, allowed_modes, visibility, persona_id, scene";

export async function loadPracticeLibrary(userId: string, scope: PracticeLibraryScope): Promise<PracticeLibraryResult> {
  const supabase = createServiceClient();

  const [{ data: memberships }, { data: ownedCompanies }, { data: profile }] = await Promise.all([
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .eq("status", "active"),
    supabase
      .from("companies")
      .select("id")
      .eq("admin_id", userId),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const isSuperAdmin = profile?.role === "super_admin";
  const memberOf = new Set([
    ...(memberships ?? []).map((m) => m.company_id),
    ...(ownedCompanies ?? []).map((c) => c.id),
  ]);

  if (scope.kind === "tenant" && !isSuperAdmin && !memberOf.has(scope.companyId)) {
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
    ? await supabase.from("ai_personas").select("id, name, display_name, rive_variant").in("id", personaIds)
    : { data: [] };
  const personaMap = new Map(
    (personas ?? []).map((p) => [
      p.id,
      {
        name: p.display_name ?? p.name,
        look: personaLookFromVariant(p.rive_variant),
      },
    ])
  );

  const items: PracticeLibraryItem[] = rows
    .map((row) => {
      const p = row.persona_id ? personaMap.get(row.persona_id) : undefined;
      return {
        id: row.id,
        title: row.title,
        goal: row.goal,
        skillPack: row.skill_pack as SkillPack,
        level: row.level,
        maxMinutes: row.max_minutes,
        allowedModes: row.allowed_modes as Mode[],
        visibility: row.visibility as "tenant_library" | "platform",
        personaName: p?.name ?? null,
        personaLook: p?.look,
        scene: sceneFromValue(row.scene),
      };
    })
    // Scenarios that only allow live cannot start yet, so they are not offered.
    .filter((item) => startableModes(item.allowedModes).length > 0);

  return { ok: true, items };
}

/**
 * One scenario from the learner's library, or (when `allowLessonOrStaff` is enabled) a published
 * course_only scenario for a member/enrolled learner or any draft/published scenario owned by an
 * academy where the user is staff. Returns null when the user may not see it.
 */
export async function findPracticeScenario(
  userId: string,
  scenarioId: string,
  scope: PracticeLibraryScope,
  options?: { allowLessonOrStaff?: boolean },
): Promise<PracticeLibraryItem | null> {
  const result = await loadPracticeLibrary(userId, scope);
  if (result.ok) {
    const found = result.items.find((item) => item.id === scenarioId);
    if (found) return found;
  }

  if (!options?.allowLessonOrStaff) return null;

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("practice_scenarios")
    .select(`${SCENARIO_COLUMNS}, status`)
    .eq("id", scenarioId)
    .maybeSingle();

  if (!row) return null;
  if (scope.kind === "tenant" && row.company_id && row.company_id !== scope.companyId && row.visibility !== "platform") {
    return null;
  }

  const [{ data: profile }, { data: membership }, { data: owned }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    row.company_id
      ? supabase
          .from("company_members")
          .select("role, status")
          .eq("company_id", row.company_id)
          .eq("profile_id", userId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.company_id
      ? supabase
          .from("companies")
          .select("id")
          .eq("id", row.company_id)
          .eq("admin_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isStaff = isTenantStaffRole(
    tenantRole({
      userId,
      profileRole: profile?.role ?? null,
      tenantOwnerId: owned ? userId : null,
      membership: membership ? { role: membership.role, status: membership.status } : null,
    }),
  );
  const isMember = isStaff || Boolean(membership);

  // Staff can preview any status/visibility in their academy.
  // Learners can open published course scenarios when launching from a lesson.
  const canOpen =
    isStaff ||
    (row.status === "published" && (row.visibility === "platform" || (row.visibility === "course" && isMember)));

  if (!canOpen) return null;

  const { data: persona } = row.persona_id
    ? await supabase
        .from("ai_personas")
        .select("id, name, display_name, rive_variant")
        .eq("id", row.persona_id)
        .maybeSingle()
    : { data: null };

  const modes = startableModes(row.allowed_modes as Mode[]);
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    skillPack: row.skill_pack as SkillPack,
    level: row.level,
    maxMinutes: row.max_minutes,
    allowedModes: modes.length > 0 ? (row.allowed_modes as Mode[]) : ["voice", "text"],
    visibility: row.visibility === "platform" ? "platform" : "tenant_library",
    personaName: persona ? (persona.display_name ?? persona.name) : null,
    personaLook: persona ? personaLookFromVariant(persona.rive_variant) : undefined,
    scene: sceneFromValue(row.scene),
  };
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
  scene: string | null;
};
