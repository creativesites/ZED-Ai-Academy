import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTryExperience } from "@/components/tutor/showcase/PublicTryExperience";
import { loadPublicTryScenario } from "@/lib/tutor/server/public-try";

export const dynamic = "force-dynamic";

function sanitizeBackUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}): Promise<Metadata> {
  const { scenarioId } = await params;
  const data = await loadPublicTryScenario(scenarioId);
  if (!data) return { title: "AI Teacher Mini-Lesson" };
  return {
    title: `Try "${data.scenario.title}" — ${data.academy.name}`,
    description: data.scenario.goal,
  };
}

export default async function PublicTryScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { scenarioId } = await params;
  const { back } = await searchParams;
  const data = await loadPublicTryScenario(scenarioId);
  if (!data) notFound();

  return (
    <PublicTryExperience
      scenarioId={data.scenario.key}
      title={data.scenario.title}
      goal={data.scenario.goal}
      maxMinutes={data.scenario.maxMinutes}
      beats={data.scenario.beats}
      scene={data.scene}
      personaName={data.scenario.persona.displayName}
      personaLanguages={data.scenario.persona.languages}
      look={data.look}
      academy={data.academy}
      backUrl={sanitizeBackUrl(back)}
    />
  );
}
