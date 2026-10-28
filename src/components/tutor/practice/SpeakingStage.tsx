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
      className={`${styles.stage} relative mx-auto aspect-[4/5] w-full max-w-[560px] min-h-[300px] sm:aspect-[5/5.4]`}
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

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className={`${styles.glass} grid gap-0 rounded-2xl px-3 py-2`}>
          <div className="font-heading text-base font-semibold leading-tight text-[var(--ink)]">{teacherName}</div>
          <div className="text-xs text-[var(--ink-dim)]">{sceneTitle}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="rounded-full border border-[var(--line)] bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
            AI teacher
          </span>
          <span className={`${styles.accent} rounded-full border border-[var(--line)] bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider`}>
            {modeLabel}
          </span>
        </div>
      </div>

      {whiteboard && (
        <div className="absolute right-3 top-[18%] max-w-[46%] rounded-xl bg-[#fbf3e6]/90 px-3 py-2 text-sm font-semibold text-[var(--ink)] shadow-lg">
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
      className={`${styles.card} ${visible ? "" : styles.cardHidden} absolute left-3 top-[24%] w-[36%] max-w-[210px] min-w-[112px] rounded-[22px] px-3 pb-3 pt-3.5 text-center backdrop-blur-md`}
    >
      {card && (
        <>
          <div className={`${tone ? styles.han : "font-heading font-semibold"} text-[clamp(28px,6vw,44px)] leading-[1.1] text-[var(--ink)]`}>
            {card.text}
          </div>
          {card.pron && <div className="mt-1 text-base text-[var(--ink)]">{card.pron}</div>}
          {card.meaning && (
            <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-dim)]">{card.meaning}</div>
          )}
          <div className={`${styles.accent} mt-2 text-[11px] font-semibold`}>+ added to your deck</div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 rounded-full border border-[var(--line-strong)] px-2.5 py-0.5 text-[11px] text-[var(--ink-dim)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            Close card
          </button>
        </>
      )}
    </div>
  );
}

function Captions({ caption }: { caption: Caption | null }) {
  if (!caption) {
    return (
      <div className={`${styles.glass} absolute inset-x-3 bottom-3 rounded-[20px] px-4 py-3 text-center text-sm text-[var(--ink-dim)]`}>
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
      className={`${styles.glass} absolute inset-x-3 bottom-3 grid gap-0.5 rounded-[20px] px-4 py-3 text-center`}
    >
      <p
        lang={han ? "zh" : undefined}
        className={`${han ? styles.han : "font-heading font-semibold"} text-[clamp(18px,2.6vw,26px)] leading-snug text-balance text-[var(--ink)]`}
      >
        {caption.native}
      </p>
      {caption.roman && (
        <p className="text-[15px] leading-snug text-[var(--ink)]">
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
      {caption.translation && <p className="text-[13px] text-[var(--ink-dim)]">{caption.translation}</p>}
    </div>
  );
}
