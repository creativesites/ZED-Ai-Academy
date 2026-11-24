// Pure helpers for the Lesson Dock ("Ask Tinashe") multi-turn chat and TTS readout.
// Pure: no I/O or "@/" imports so node:test runs it directly.

export type DockChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiTurnContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

export const MAX_DOCK_HISTORY_TURNS = 12;
export const MAX_DOCK_HISTORY_ENTRY_CHARS = 1500;
export const MAX_DOCK_SPEECH_CHARS = 580;

/**
 * Normalizes recent dock history and appends the current user message into valid alternating
 * Gemini `contents` (merging consecutive same-role messages and trimming to the last 12 turns).
 */
export function buildDockContents(
  rawHistory: unknown,
  currentMessage: string,
): GeminiTurnContent[] {
  const contents: GeminiTurnContent[] = [];
  const push = (role: "user" | "model", text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: cleaned });
    } else {
      contents.push({ role, parts: [{ text: cleaned }] });
    }
  };

  if (Array.isArray(rawHistory)) {
    const normalized: DockChatMessage[] = [];
    for (const item of rawHistory) {
      if (!item || typeof item !== "object") continue;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
      const trimmed = content.trim();
      if (!trimmed) continue;
      normalized.push({
        role,
        content: trimmed.slice(0, MAX_DOCK_HISTORY_ENTRY_CHARS),
      });
    }

    // Keep the most recent turns and ensure history begins with a user turn when possible
    // so Gemini doesn't see an orphaned greeting as turn 0.
    const recent = normalized.slice(-MAX_DOCK_HISTORY_TURNS);
    const firstUserIdx = recent.findIndex((m) => m.role === "user");
    const slice = firstUserIdx >= 0 ? recent.slice(firstUserIdx) : [];

    for (const entry of slice) {
      push(entry.role === "assistant" ? "model" : "user", entry.content);
    }
  }

  push("user", currentMessage);
  return contents;
}

/**
 * Strips `:::component { ... }:::` blocks, fenced code blocks, and markdown formatting
 * from an AI Teacher dock reply so TTS reads clean, natural speech.
 */
export function stripDockMarkupForSpeech(raw: string): string {
  const withoutComponents = raw.replace(/:::[a-z_]+[\s\S]*?:::/gi, " ");
  const withoutCodeBlocks = withoutComponents.replace(/```[\s\S]*?```/g, " ");
  const withoutMarkdown = withoutCodeBlocks
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]{1,3}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutMarkdown.length <= MAX_DOCK_SPEECH_CHARS) return withoutMarkdown;
  const clipped = withoutMarkdown.slice(0, MAX_DOCK_SPEECH_CHARS);
  const lastSentence = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
  return (lastSentence > 120 ? clipped.slice(0, lastSentence + 1) : clipped).trim();
}
