// Friendly messages for ZAI Tutor API failures. Pure, no React, safe to import from client code.
// Status and reason codes follow docs/TUTOR_API.md. Unknown codes get a generic message, never a raw body.

export type TutorFailure =
  | { kind: "http"; status: number; reason?: string; error?: string; detail?: string }
  | { kind: "network" };

export type TutorErrorContext = "start" | "turn" | "complete";

const REASON_MESSAGES: Record<string, string> = {
  not_tenant_member: "You need to be a member of this academy to practise here.",
  tenant_inactive: "This academy is not active right now.",
  not_enrolled: "Enrol in the course to start this session.",
  scenario_not_in_library: "This scenario is not in the Practice Room.",
  practice_disabled: "The Practice Room is turned off for this academy.",
  free_minutes_exhausted: "You have used this month's free practice minutes. They refresh next month.",
  lesson_course_mismatch: "This lesson link is out of date. Go back and open the lesson again.",
  assignment_scenario_mismatch: "This assignment link is out of date. Refresh the page and try again.",
  assignment_not_for_learner: "This assignment is not assigned to you.",
  scenario_not_published: "This scenario is not published yet.",
  persona_unavailable: "The teacher for this scenario is unavailable right now.",
  no_modes_allowed: "No practice modes are available for this scenario.",
  scenario_not_found: "We could not find that scenario.",
  lesson_not_found: "We could not find that lesson.",
  assignment_not_found: "We could not find that assignment.",
  gemini_no_key: "The AI teacher is not set up yet: the Gemini API key is missing on the server.",
  gemini_auth: "The AI teacher is not set up correctly: the Gemini API key was rejected.",
  gemini_model: "The AI model is not available to this Gemini key. Check the key's project and region.",
  gemini_quota: "The AI teacher is busy (usage limit reached). Try again in a minute.",
  gemini_unavailable: "The AI service is briefly unavailable. Try again in a moment.",
};

/** The message to show for a failed call. `context` only changes wording for the 409 case. */
export function tutorErrorMessage(failure: TutorFailure, context: TutorErrorContext = "turn"): string {
  if (failure.kind === "network") {
    return "You seem to be offline. Check your connection and try again.";
  }

  const { status, reason, error } = failure;
  if (reason && REASON_MESSAGES[reason]) return REASON_MESSAGES[reason];

  switch (status) {
    case 400:
      return "That message could not be sent. Check it and try again.";
    case 401:
      return "Sign in again to continue.";
    case 403:
      return "You do not have access to this practice session.";
    case 404:
      return context === "start" ? "We could not find that scenario." : "We could not find this session.";
    case 409:
      if (error && /not active/i.test(error)) {
        return "This session has already ended. Start a new one to keep practising.";
      }
      return "The teacher is still catching up. Try again in a moment.";
    case 413:
      return "That recording is too long. Keep it under 30 seconds.";
    case 415:
      return "This browser recorded audio in a format we cannot read. Try text mode instead.";
    case 422:
      return "We could not hear any speech. Try again, a little closer to the microphone.";
    case 429:
      return "You have started a lot of sessions recently. Try again later.";
    case 502:
      return context === "complete"
        ? "Your report is taking longer than expected. Try again in a moment."
        : "The teacher could not respond. Try again.";
    default:
      return "Something went wrong on our side. Try again.";
  }
}

/** Reads `{ error?, reason? }` from a JSON error body, ignoring anything else. */
export function parseTutorErrorBody(body: unknown): { error?: string; reason?: string; detail?: string } {
  if (typeof body !== "object" || body === null) return {};
  const { error, reason, detail } = body as { error?: unknown; reason?: unknown; detail?: unknown };
  return {
    error: typeof error === "string" ? error : undefined,
    reason: typeof reason === "string" ? reason : undefined,
    ...(typeof detail === "string" ? { detail } : {}),
  };
}
