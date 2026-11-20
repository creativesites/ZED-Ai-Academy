"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Play,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Wand2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { ScenarioEditorModal } from "@/components/tutor/studio/ScenarioEditorModal";
import { TUTOR_STYLE_LABELS, overlayModes } from "@/lib/tutor/tutor-session-block";
import {
  deleteScenario,
  seedStarterPersonas,
  updateScenarioQuick,
  type PersonaRecord,
  type ScenarioRecord,
} from "@/actions/tutor-authoring";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function CourseTutorTab({
  courseId,
  companyId,
  tenantSlug,
  initialPersonas,
  initialScenarios,
}: {
  courseId: string;
  companyId: string;
  tenantSlug?: string;
  initialPersonas: PersonaRecord[];
  initialScenarios: ScenarioRecord[];
}) {
  const [personas, setPersonas] = useState<PersonaRecord[]>(initialPersonas);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>(initialScenarios);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioRecord | null>(null);
  const [previewScenario, setPreviewScenario] = useState<ScenarioRecord | null>(null);
  const [isBusy, startBusy] = useTransition();

  const manageTeachersHref = tenantSlug
    ? `/academy/${tenantSlug}/admin/ai-teachers`
    : "/creator/ai-teachers";

  function handleSaved(saved: ScenarioRecord) {
    setScenarios((prev) =>
      prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...prev]
    );
  }

  function handleSeedPersonas() {
    startBusy(async () => {
      try {
        const seeded = await seedStarterPersonas(companyId);
        setPersonas(seeded);
        toast.success("Starter AI teacher cast added! You can now pick them in scenarios.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not import starter cast");
      }
    });
  }

  function toggleStatus(s: ScenarioRecord) {
    const nextStatus = s.status === "published" ? "draft" : "published";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { status: nextStatus });
        handleSaved(updated);
        toast.success(nextStatus === "published" ? "Scenario published" : "Moved to draft");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  function toggleVisibility(s: ScenarioRecord) {
    const nextVis = s.visibility === "tenant_library" ? "course" : "tenant_library";
    startBusy(async () => {
      try {
        const updated = await updateScenarioQuick(companyId, s.id, { visibility: nextVis });
        handleSaved(updated);
        toast.success(
          nextVis === "tenant_library"
            ? "Shared to Academy Practice Room"
            : "Limited to this course"
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update visibility");
      }
    });
  }

  function handleDelete(s: ScenarioRecord) {
    if (!confirm(`Delete "${s.title}"?`)) return;
    startBusy(async () => {
      try {
        await deleteScenario(companyId, s.id);
        setScenarios((prev) => prev.filter((x) => x.id !== s.id));
        toast.success("Scenario deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete scenario");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6ee] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#fd5523]">
            <Sparkles className="h-3.5 w-3.5" />
            Animated AI Language Teacher
          </div>
          <h2 className="text-xl font-black text-[#062e39]">Course Speaking Scenarios</h2>
          <p className="max-w-2xl text-xs text-slate-500 sm:text-sm">
            Create interactive role-plays, guided speaking lessons, or oral checks for this course. Published scenarios appear in your Lesson Studio &quot;Speaking&quot; blocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={manageTeachersHref}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-[#062e39] hover:bg-slate-100"
          >
            Customize AI Teachers
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <Button
            type="button"
            onClick={() => {
              setEditingScenario(null);
              setEditorOpen(true);
            }}
            className="h-10 rounded-xl bg-[#fd5523] px-4 text-xs font-bold text-white hover:bg-[#ea4817]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Speaking Scenario
          </Button>
        </div>
      </div>

      {/* Starter cast notice if no personas exist yet */}
      {personas.length === 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-950">No AI teacher personas configured yet</p>
            <p className="text-xs text-amber-800">
              Import the 5 animated starter teachers (Lín Lǎoshī, Sofía, Camille, Nurse Tendai, Tinashe) in one click so you can assign them to scenarios.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={handleSeedPersonas}
            className="shrink-0 rounded-xl bg-[#062e39] text-xs font-bold text-white hover:bg-[#0a4352]"
          >
            {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
            Import Starter Cast
          </Button>
        </div>
      )}

      {/* Scenario Cards */}
      {scenarios.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-[#1a1338] to-[#321b4e] shadow-lg">
            <Teacher
              variant="bust"
              persona={personas[0]?.rive_variant ?? DEFAULT_PERSONA_LOOK}
              className="h-24 w-24"
              label="Animated AI teacher"
            />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#062e39]">Add your first AI speaking scenario</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 sm:text-sm">
            Draft a speaking role-play manually or let AI build one from your course curriculum. Learners will practise out loud with the animated 3D/Rive teacher.
          </p>
          <Button
            type="button"
            onClick={() => {
              setEditingScenario(null);
              setEditorOpen(true);
            }}
            className="mt-5 h-11 rounded-xl bg-[#fd5523] px-6 font-bold text-white hover:bg-[#ea4817]"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create Speaking Scenario
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a1338] to-[#321b4e]">
                  <Teacher
                    variant="bust"
                    persona={s.persona?.look ?? DEFAULT_PERSONA_LOOK}
                    className="h-16 w-16"
                    label={s.persona?.display_name ?? s.persona?.name ?? "AI Teacher"}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === "published"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {TUTOR_STYLE_LABELS[s.style]}
                    </span>
                    {s.level && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {s.level}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate text-sm font-bold text-[#062e39]">{s.title}</h3>
                  <p className="line-clamp-2 text-xs text-slate-500">{s.goal}</p>
                  <p className="text-[11px] text-slate-400">
                    {s.persona ? `${s.persona.display_name || s.persona.name} · ` : ""}
                    {s.max_minutes} min · {s.beats.length} beats
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => toggleStatus(s)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {s.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => toggleVisibility(s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {s.visibility === "tenant_library" ? (
                      <>
                        <Globe className="h-3 w-3 text-emerald-600" /> Practice Room
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3 text-slate-400" /> Course Only
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewScenario(s)}
                    className="h-8 rounded-lg px-2.5 text-xs font-bold"
                  >
                    <Play className="mr-1 h-3 w-3 text-[#fd5523]" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingScenario(s);
                      setEditorOpen(true);
                    }}
                    className="h-8 rounded-lg px-2.5 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleDelete(s)}
                    className="h-8 rounded-lg border-red-100 px-2.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <ScenarioEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          companyId={companyId}
          courseId={courseId}
          personas={personas}
          initialScenario={editingScenario}
          onSaved={handleSaved}
        />
      )}

      <Dialog open={Boolean(previewScenario)} onOpenChange={(o) => !o && setPreviewScenario(null)}>
        <DialogContent className="h-[85vh] max-w-5xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Preview Speaking Scenario</DialogTitle>
          <DialogDescription className="sr-only">
            Run this speaking scenario with the animated AI teacher.
          </DialogDescription>
          {previewScenario && (
            <TutorSession
              origin="practice"
              scenarioId={previewScenario.id}
              scene={previewScenario.scene ?? undefined}
              look={previewScenario.persona?.look}
              preview={{
                teacherName: previewScenario.persona?.display_name ?? previewScenario.persona?.name,
                title: previewScenario.title,
                goal: previewScenario.goal,
                maxMinutes: previewScenario.max_minutes,
                modes: overlayModes(previewScenario.allowed_modes),
              }}
              onExit={() => setPreviewScenario(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
