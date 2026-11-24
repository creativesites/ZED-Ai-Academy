import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTryExperience } from "@/components/tutor/showcase/PublicTryExperience";
import { loadPublicTryScenario } from "@/lib/tutor/server/public-try";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}): Promise<Metadata> {
  const { scenarioId } = await params;
  const data = await loadPublicTryScenario(scenarioId);
  if (!data) return { title: "AI Teacher Mini-Lesson — Zed AI Academy" };
  return {
    title: `Try "${data.scenario.title}" — ${data.academy.name}`,
    description: data.scenario.goal,
  };
}

export default async function PublicTryScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const data = await loadPublicTryScenario(scenarioId);
  if (!data) notFound();

  return (
    <PublicTryExperience
      scenarioId={data.scenario.key}
      title={data.scenario.title}
      goal={data.scenario.goal}
      maxMinutes={data.scenario.maxMinutes}
      scene={data.scene}
      personaName={data.scenario.persona.displayName}
      personaLanguages={data.scenario.persona.languages}
      look={data.look}
      academy={data.academy}
    />
  );
}
