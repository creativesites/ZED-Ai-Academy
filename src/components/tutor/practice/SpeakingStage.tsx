"use client";

import { useState, type Ref } from "react";
import { Eye, EyeOff, RotateCcw, Snail, Sparkles } from "lucide-react";
import { TeacherStage } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherEngine } from "@/components/tutor/avatar/Teacher";
import type { AvatarEvent, PersonaLook } from "@/components/tutor/avatar/types";
import type { CardItem } from "@/components/tutor/EventPlayer";
import { DAYLIGHT_TIME_OF_DAY, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { toneSegments } from "@/lib/tutor/romanization";
import styles from "./practice.module.css";

// The stage: teacher on top, persona tags, flashcard, whiteboard, celebration sparkles, and captions.
// Captions are always on screen with 1-tap Replay, Slow Replay (0.75x), and Translation toggle.

export type Caption = { native: string; roman?: string; translation?: string };

const HAN = /[㐀-鿿豈-﫿]/;

export function hasHan(text: string): boolean {
  return HAN.test(text);
}

/** CSS class for a pinyin tone colour. Tone 0 (neutral or punctuation) has no colour. */
export function toneClass(tone: 0 | 1 | 2 | 3 | 4): string {
  switch (tone) {
    case 1:
      return styles.tone1;
    case 2:
      return styles.tone2;
    case 3:
      return styles.tone3;
    case 4:
      return styles.tone4;
    default:
      return "";
  }
}

type SpeakingStageProps = {
  avatarRef: Ref<TeacherStageHandle>;
  onAvatarEvent: (e: AvatarEvent) => void;
  reducedMotion: boolean;
  /** Rive teacher by default. "placeholder" keeps the SVG teacher. */
  engine?: TeacherEngine;
  /** Backdrop scene for the Rive engine. */
  scene?: SceneArtboard;
  look?: Partial<PersonaLook>;
  teacherName: string;
  sceneTitle: string;
  modeLabel: string;
  caption: Caption | null;
  card: CardItem | null;
  onDismissCard: () => void;
  whiteboard: string | null;
  canReplay?: boolean;
  onReplay?: () => void;
  onReplaySlow?: () => void;
  /** Incrementing counter that triggers a brief sparkle celebration burst on awards. */
  celebratePulse?: number;
};

const SPARKLES = [
  { top: "14%", left: "18%", color: "#fd5523", delay: "0ms" },
  { top: "20%", left: "78%", color: "#15805f", delay: "70ms" },
  { top: "36%", left: "12%", color: "#f59e0b", delay: "130ms" },
  { top: "32%", left: "86%", color: "#3b82f6", delay: "90ms" },
  { top: "10%", left: "50%", color: "#ec4899", delay: "40ms" },
  { top: "46%", left: "76%", color: "#fd5523", delay: "160ms" },
] as const;

export function SpeakingStage({
  avatarRef,
  onAvatarEvent,
  reducedMotion,
  engine = "rive",
  scene = "Scene_TeaHouse",
  look,
  teacherName,
  sceneTitle,
  modeLabel,
  caption,
  card,
  onDismissCard,
  whiteboard,
  canReplay = false,
  onReplay,
  onReplaySlow,
  celebratePulse = 0,
}: SpeakingStageProps) {
  return (
    <section
      aria-label={`Scene: ${sceneTitle}`}
      className={`${styles.stage} relative mx-auto h-[clamp(220px,38dvh,330px)] w-full max-w-[560px] sm:h-[clamp(280px,46dvh,430px)] lg:h-[clamp(360px,56dvh,520px)]`}
    >
      <TeacherStage
        ref={avatarRef}
        engine={engine}
        scene={scene}
        timeOfDay={DAYLIGHT_TIME_OF_DAY}
        persona={look}
        reducedMotion={reducedMotion}
        onEvent={onAvatarEvent}
      />

      {/* Lightweight sparkle celebration burst on awards */}
      {celebratePulse > 0 && !reducedMotion && (
        <div
          key={celebratePulse}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
        >
          {SPARKLES.map((sp, i) => (
            <span
              key={i}
              style={{
                top: sp.top,
                left: sp.left,
                color: sp.color,
                animationDelay: sp.delay,
              }}
              className="absolute animate-ping"
            >
              <Sparkles className="h-5 w-5" />
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-2">
        <div className={`${styles.glass} grid max-w-[62%] gap-0 rounded-xl px-2.5 py-1 sm:rounded-2xl sm:px-3 sm:py-1.5`}>
          <div className="truncate font-heading text-xs font-semibold leading-tight text-[var(--ink)] sm:text-sm">
            {teacherName}
          </div>
          <div className="truncate text-[10px] text-[var(--ink-dim)] sm:text-xs">{sceneTitle}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <span
            className={`${styles.accent} rounded-full border border-[var(--line)] bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:px-2.5 sm:py-1 sm:text-[11px]`}
          >
            {modeLabel}
          </span>
        </div>
      </div>

      {whiteboard && (
        <div className="absolute right-2 top-[16%] max-w-[48%] rounded-xl bg-[#fbf3e6]/95 px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-md sm:right-3 sm:top-[18%] sm:px-3 sm:py-2 sm:text-sm">
          {whiteboard}
        </div>
      )}

      <FlashCard card={card} onDismiss={onDismissCard} />

      <Captions
        caption={caption}
        canReplay={canReplay}
        onReplay={onReplay}
        onReplaySlow={onReplaySlow}
      />
    </section>
  );
}

function FlashCard({ card, onDismiss }: { card: CardItem | null; onDismiss: () => void }) {
  const visible = card !== null;
  const tone = card ? hasHan(card.text) : false;
  return (
    <div
      aria-live="polite"
      className={`${styles.card} ${visible ? "" : styles.cardHidden} absolute left-2 top-[20%] w-[40%] max-w-[180px] min-w-[100px] rounded-2xl px-2.5 pb-2 pt-2.5 text-center backdrop-blur-md sm:left-3 sm:top-[22%] sm:w-[36%] sm:rounded-[22px] sm:px-3 sm:pb-3 sm:pt-3`}
    >
      {card && (
        <>
          <div
            className={`${tone ? styles.han : "font-heading font-semibold"} text-[clamp(18px,4.5vw,34px)] leading-[1.1] text-[var(--ink)]`}
          >
            {card.text}
          </div>
          {card.pron && <div className="mt-0.5 text-xs text-[var(--ink)] sm:text-sm">{card.pron}</div>}
          {card.meaning && (
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-dim)] sm:text-[11px]">
              {card.meaning}
            </div>
          )}
          <div className={`${styles.accent} mt-1 text-[10px] font-semibold sm:text-[11px]`}>+ saved to deck</div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-1 rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[10px] text-[var(--ink-dim)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
}

function Captions({
  caption,
  canReplay,
  onReplay,
  onReplaySlow,
}: {
  caption: Caption | null;
  canReplay: boolean;
  onReplay?: () => void;
  onReplaySlow?: () => void;
}) {
  const [showTranslation, setShowTranslation] = useState(true);

  if (!caption) {
    return (
      <div
        className={`${styles.glass} absolute inset-x-2 bottom-2 rounded-2xl px-3 py-1.5 text-center text-xs text-[var(--ink-dim)] sm:inset-x-3 sm:bottom-3 sm:px-4 sm:py-2.5 sm:text-sm`}
      >
        Captions appear here.
      </div>
    );
  }
  const han = hasHan(caption.native);
  return (
    <div
      role="region"
      aria-label="Captions"
      aria-live="polite"
      className={`${styles.glass} absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-2xl px-3 py-2 sm:inset-x-3 sm:bottom-3 sm:px-4 sm:py-2.5`}
    >
      <div className="min-w-0 flex-1 text-center">
        <p
          lang={han ? "zh" : undefined}
          className={`${han ? styles.han : "font-heading font-semibold"} text-[clamp(13px,3.4vw,20px)] leading-snug text-balance text-[var(--ink)]`}
        >
          {caption.native}
        </p>
        {caption.roman && (
          <p className="mt-0.5 text-xs leading-snug text-[var(--ink)] sm:text-sm">
            {han
              ? toneSegments(caption.roman).map((seg, i) =>
                  seg.tone > 0 ? (
                    <span key={i} className={toneClass(seg.tone)}>
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )
              : caption.roman}
          </p>
        )}
        {caption.translation && showTranslation && (
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-dim)] sm:text-xs">{caption.translation}</p>
        )}
      </div>

      {(canReplay || caption.translation) && (
        <div className="flex shrink-0 flex-col gap-1">
          {canReplay && onReplay && (
            <button
              type="button"
              onClick={onReplay}
              title="Replay teacher's last line"
              aria-label="Replay teacher's last line"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/90 text-[var(--ink-dim)] transition hover:bg-[var(--soft-hover)] hover:text-[var(--ink)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {canReplay && onReplaySlow && (
            <button
              type="button"
              onClick={onReplaySlow}
              title="Replay slowly (0.75×)"
              aria-label="Replay slowly at 0.75x speed"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/90 text-[var(--ink-dim)] transition hover:bg-[#fff2e9] hover:text-[#fd5523]"
            >
              <Snail className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {caption.translation && (
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              title={showTranslation ? "Hide translation" : "Show translation"}
              aria-label={showTranslation ? "Hide translation" : "Show translation"}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/90 text-[var(--ink-dim)] transition hover:bg-[var(--soft-hover)] hover:text-[var(--ink)]"
            >
              {showTranslation ? (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
