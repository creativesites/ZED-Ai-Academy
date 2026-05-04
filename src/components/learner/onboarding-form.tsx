"use client";

import { useState } from "react";
import { completeOnboarding } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Sparkles, Zap, GraduationCap, BookOpen } from "lucide-react";

const GOALS = [
  { id: "use-ai-at-work", label: "Use AI tools at work daily", icon: Zap },
  { id: "build-ai-skills", label: "Build AI skills from scratch", icon: GraduationCap },
  { id: "lead-ai-teams", label: "Lead AI adoption in my team", icon: Sparkles },
  { id: "explore", label: "Explore what AI can do for me", icon: BookOpen },
];

const LEVELS = [
  { id: "beginner", label: "Complete beginner", desc: "Never used AI tools before" },
  { id: "intermediate", label: "Some experience", desc: "I've tried ChatGPT or similar" },
  { id: "advanced", label: "Advanced", desc: "I use AI regularly at work" },
];

export function OnboardingForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("full_name", name);
    fd.set("level", level);
    fd.set("goal", goal);
    await completeOnboarding(fd);
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "20px", background: "#fff2e9", color: "#fd5523", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
          <Sparkles style={{ width: "14px", height: "14px" }} />
          Welcome to Zed AI Academy
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, color: "#062e39", marginBottom: "12px", lineHeight: 1.15 }}>
          {step === 1 ? "Let's get you set up" : "How do you learn best?"}
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: 1.6, maxWidth: "440px", margin: "0 auto" }}>
          {step === 1
            ? "A quick 2-step setup so we can personalise your learning experience."
            : "We'll use this to recommend the right starting point for you."}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "40px" }}>
        {[1, 2].map((s) => (
          <div key={s} style={{
            width: s === step ? "32px" : "8px", height: "8px", borderRadius: "4px",
            background: s === step ? "#fd5523" : s < step ? "#fd5523" : "#e5e5e5",
            transition: "all 0.3s",
          }} />
        ))}
      </div>

      {/* Step 1: Name */}
      {step === 1 && (
        <form onSubmit={handleStep1} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <Label htmlFor="full_name" className="text-sm font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: "10px", display: "block" }}>
              Your full name
            </Label>
            <Input
              id="full_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mwansa Kabwe"
              required
              className="h-14 rounded-2xl border-slate-200 bg-white text-xl font-medium text-[#062e39]"
            />
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "14px" }}>{error}</p>}
          <Button
            type="submit"
            className="h-14 rounded-full bg-[#fd5523] text-base font-bold text-white hover:bg-[#ef4a16]"
          >
            Continue <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </form>
      )}

      {/* Step 2: Level + Goal */}
      {step === 2 && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "12px" }}>
              Your AI experience level
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 18px", borderRadius: "14px", border: "2px solid",
                    borderColor: level === l.id ? "#fd5523" : "#e5e5e5",
                    background: level === l.id ? "#fff2e9" : "#fff",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", border: "2px solid",
                    borderColor: level === l.id ? "#fd5523" : "#d1d5db",
                    background: level === l.id ? "#fd5523" : "transparent", flexShrink: 0,
                  }} />
                  <div>
                    <p style={{ fontWeight: 700, color: "#062e39", fontSize: "14px", margin: 0 }}>{l.label}</p>
                    <p style={{ color: "#999", fontSize: "12px", margin: "2px 0 0" }}>{l.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "12px" }}>
              What's your main goal?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {GOALS.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px",
                      padding: "16px", borderRadius: "14px", border: "2px solid",
                      borderColor: goal === g.id ? "#fd5523" : "#e5e5e5",
                      background: goal === g.id ? "#fff2e9" : "#fff",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}
                  >
                    <Icon style={{ width: "20px", height: "20px", color: goal === g.id ? "#fd5523" : "#bbb" }} />
                    <p style={{ fontWeight: 600, color: "#062e39", fontSize: "13px", margin: 0, lineHeight: 1.4 }}>{g.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            className="h-14 rounded-full bg-[#062e39] text-base font-bold text-white hover:bg-[#0a4055]"
          >
            Find my first course <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </form>
      )}
    </div>
  );
}
