"use client";

import type { Ref } from "react";
import { TeacherStage } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherEngine } from "@/components/tutor/avatar/Teacher";
import type { AvatarEvent, PersonaLook } from "@/components/tutor/avatar/types";
import type { CardItem } from "@/components/tutor/EventPlayer";
import { DAYLIGHT_TIME_OF_DAY, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { toneSegments } from "@/lib/tutor/romanization";
import styles from "./practice.module.css";

// The stage: teacher on top, persona tags, flashcard, whiteboard and captions. Captions are
// always on screen. Native text is large. Romanization is tone-coloured when the native line has Han
// characters. The English translation is small.

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
};

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
}: SpeakingStageProps) {
  return (
    <section
      aria-label={`Scene: ${sceneTitle}`}
      className={`${styles.stage} relative mx-auto aspect-[4/3.8] w-full max-w-[560px] min-h-[260px] sm:aspect-[5/5.2]`}
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

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-2">
        <div className={`${styles.glass} grid max-w-[58%] gap-0 rounded-xl px-2.5 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2`}>
          <div className="truncate font-heading text-xs font-semibold leading-tight text-[var(--ink)] sm:text-base">{teacherName}</div>
          <div className="truncate text-[10px] text-[var(--ink-dim)] sm:text-xs">{sceneTitle}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1 sm:gap-1.5">
          <span className="hidden rounded-full border border-[var(--line)] bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)] sm:inline-flex">
            AI teacher
          </span>
          <span className={`${styles.accent} rounded-full border border-[var(--line)] bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:px-2.5 sm:py-1 sm:text-[11px]`}>
            {modeLabel}
          </span>
        </div>
      </div>

      {whiteboard && (
        <div className="absolute right-2 top-[16%] max-w-[48%] rounded-xl bg-[#fbf3e6]/92 px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-md sm:right-3 sm:top-[18%] sm:px-3 sm:py-2 sm:text-sm">
          {whiteboard}
        </div>
      )}

      <FlashCard card={card} onDismiss={onDismissCard} />

      <Captions caption={caption} />
    </section>
  );
}

function FlashCard({ card, onDismiss }: { card: CardItem | null; onDismiss: () => void }) {
  const visible = card !== null;
  const tone = card ? hasHan(card.text) : false;
  return (
    <div
      aria-live="polite"
      className={`${styles.card} ${visible ? "" : styles.cardHidden} absolute left-2 top-[22%] w-[40%] max-w-[190px] min-w-[104px] rounded-2xl px-2.5 pb-2.5 pt-3 text-center backdrop-blur-md sm:left-3 sm:top-[24%] sm:w-[36%] sm:rounded-[22px] sm:px-3 sm:pb-3 sm:pt-3.5`}
    >
      {card && (
        <>
          <div className={`${tone ? styles.han : "font-heading font-semibold"} text-[clamp(20px,5vw,38px)] leading-[1.1] text-[var(--ink)]`}>
            {card.text}
          </div>
          {card.pron && <div className="mt-1 text-xs text-[var(--ink)] sm:text-sm">{card.pron}</div>}
          {card.meaning && (
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-dim)] sm:text-[11px]">{card.meaning}</div>
          )}
          <div className={`${styles.accent} mt-1.5 text-[10px] font-semibold sm:text-[11px]`}>+ added to deck</div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-1.5 rounded-full border border-[var(--line-strong)] px-2 py-0.5 text-[10px] text-[var(--ink-dim)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:px-2.5 sm:text-[11px]"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
}

function Captions({ caption }: { caption: Caption | null }) {
  if (!caption) {
    return (
      <div className={`${styles.glass} absolute inset-x-2 bottom-2 rounded-2xl px-3 py-2 text-center text-xs text-[var(--ink-dim)] sm:inset-x-3 sm:bottom-3 sm:rounded-[20px] sm:px-4 sm:py-3 sm:text-sm`}>
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
      className={`${styles.glass} absolute inset-x-2 bottom-2 grid gap-0.5 rounded-2xl px-3 py-2 text-center sm:inset-x-3 sm:bottom-3 sm:rounded-[20px] sm:px-4 sm:py-3`}
    >
      <p
        lang={han ? "zh" : undefined}
        className={`${han ? styles.han : "font-heading font-semibold"} text-[clamp(14px,3.6vw,22px)] leading-snug text-balance text-[var(--ink)]`}
      >
        {caption.native}
      </p>
      {caption.roman && (
        <p className="text-xs leading-snug text-[var(--ink)] sm:text-sm">
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
      {caption.translation && <p className="text-[11px] text-[var(--ink-dim)] sm:text-xs">{caption.translation}</p>}
    </div>
  );
}
